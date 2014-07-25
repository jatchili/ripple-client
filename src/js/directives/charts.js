/**
 * CHARTS
 *
 * Charts and data visualization directives go into this file.
 */

var module = angular.module('charts', []);

/**
 * Trust line graph. (Similar to small box plot.)
 */
module.directive('rpTrustLine', ['$filter', function($filter) {
  function redraw(ctx, data) {
    // Axis distance to left and right edges
    var axisMargin = 30;
    // Tick length away from axis
    var tickLen    = 5;
    // Thickness of bars
    var barWidth   = 6;
    // Offset for text below axis
    var lowText    = 16;
    // Offset for text above bar
    var highText   = -10;

    // Fetch size of canvas
    var width      = ctx.canvas.width;
    var height     = ctx.canvas.height;
    var axisLen    = width - axisMargin * 2;
    var axisY      = Math.floor(height/2);

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Parse input data
    var trust_l, trust_r, balance;
    try {
      trust_l = -data.limit_peer.to_number();
      trust_r = data.limit.to_number();
      balance = data.balance.to_number();
    } catch (e) {
      // In case of invalid input data we simply skip drawing the chart.
      return;
    }

    // Calculate minimum and maximum logical point
    var min        = Math.min(balance, trust_l);
    var max        = Math.max(balance, trust_r);
    var scale      = axisLen / (max - min);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#333';

    // Draw balance
    if (balance > 0) {
      ctx.beginPath();
      ctx.rect(f(0), axisY-barWidth, f(balance)-f(0), barWidth);
      ctx.fillStyle = 'green';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.rect(f(balance), axisY, f(0)-f(balance), barWidth);
      ctx.fillStyle = balance === 0 ? 'black' : 'red';
      ctx.fill();
    }

    ctx.beginPath();
    // Draw axis
    ctx.moveTo(f(trust_l), axisY);
    ctx.lineTo(f(trust_r), axisY);
    // Left end tick
    ctx.moveTo(f(trust_l), axisY-tickLen);
    ctx.lineTo(f(trust_l), axisY+tickLen);
    // Right end tick
    ctx.moveTo(f(trust_r), axisY-tickLen);
    ctx.lineTo(f(trust_r), axisY+tickLen);
    // Origin tick
    ctx.moveTo(f(0),       axisY-tickLen);
    ctx.lineTo(f(0),       axisY+tickLen);
    ctx.stroke();

    // Draw labels
    var rpamount = $filter('rpamount');
    var fmt = {rel_precision: 0};
    ctx.font = "11px sans-serif";
    ctx.textAlign = 'center';
    ctx.fillText(rpamount(data.balance, fmt), f(balance), axisY+highText);
    ctx.fillStyle = '#333';

    var lAmount = rpamount(data.limit_peer, fmt);

    if (0 !== trust_l)
      lAmount = "-"+lAmount;

    if (trust_l === trust_r && 0 === trust_l) {
      lAmount = "0 / 0";
    } else {
      ctx.fillText(rpamount(data.limit, fmt), f(trust_r), axisY+lowText);
    }

    ctx.fillText(lAmount, f(trust_l), axisY+lowText);

    // Exchange a value to a pixel position
    function f(val)
    {
      // Enforce limits
      val = Math.min(val, max);
      val = Math.max(val, min);
      return Math.round((val - min) * scale + axisMargin);
    }
  }

  return {
    restrict: 'E',
    template: '<canvas width="140" height="50">',
    scope: {
      data: '=rpLineData'
    },
    link: function(scope, elm, attrs) {
      var ctx = elm.find('canvas')[0].getContext('2d');

      redraw(ctx, scope.data);

      scope.$watch('data', function () {
        redraw(ctx, scope.data);
      }, true);
    }
  };
}]);



/**
 * Balance pie chart
 */
module.directive('rpPieChart', ['$filter', 'rpColorManager', function($filter, $colorManager) {
  var rpcurrency = $filter('rpcurrency');
  var rpcontactname = $filter('rpcontactname');
  function contactButNotXrp(x) {
    return x==="XRP" ? "XRP" : rpcontactname(x);
  }

  function pieChart(element, scope) {
    
    var SIZE = parseInt(scope.size, 10);
    
    function drawPieChart(container, exchangeRates, drops, ious) {
      
      if (drops && exchangeRates && Object.keys(exchangeRates).length) {} else {
        return;
      }
      
      var xrpAsSuch = parseInt(drops,10) / 1000000;      
      var subbalancesAsXrp = [[xrpAsSuch]];
      var totalAsXrp = xrpAsSuch;
      var amounts = ["1"];
      var issuerses = [["XRP"]];
      for (var cur in ious) {if (ious.hasOwnProperty(cur)){
        var components = ious[cur].components;
        
        var sbs = [];
        var issuers = [];
        var issuer;
        for (issuer in components) {if (components.hasOwnProperty(issuer)){
          var rate = (exchangeRates[cur+":"+issuer] || 0);
          var sbAsXrp = components[issuer].to_number() * rate;
          totalAsXrp += sbAsXrp;
          sbs.push(sbAsXrp);
          issuers.push(issuer);
        }}
        subbalancesAsXrp.push(sbs);
        issuerses.push(issuers);
        amounts.push(components[issuer]);
      }}
      
      // Scale to have an overall sum of 1
      var subshareses = subbalancesAsXrp.map(function(x){return x.map(function(y){return y/totalAsXrp})});
      // Add up each group of subshares to get shares
      var shares = subshareses.map(function(x){return x.reduce(function(a,b){return a+b})});
      var currencies = amounts.map(function(a){return rpcurrency(a)});
      var colors = $colorManager.colorsForCurrencies(currencies);
      //TODO: stop trying to maintain parallel arrays; sort the sectors from largest to smallest
      
      
      // Prepare the container
      container.find('*').remove()
      container.append('<svg></svg>');
      
      // Draw the subsectors
      for (var i=0; i<subshareses.length; i++) {
        var offset = 0;
        for (var j=0; j<i; j++) {
          offset += shares[j];
        }
        drawSectors(
          container,
          subshareses[i],
          issuerses[i].map(contactButNotXrp),
          $colorManager.shades(colors[i]),
          "sub",
          currencies[i],
          offset
        );
      }
      
      // Draw the main sectors.
      // This must come last, so that the onMouseOver works.
      drawSectors(container, shares, currencies, colors, "main", currencies);
      
      // Draw the hole in the middle
      $('<circle></circle>').appendTo(container.find('svg')).attr({
        fill: "#fff",
        cx:   SIZE/2,
        cy:   SIZE/2,
        r:    SIZE/6
      });
      
      // Refresh the DOM (because JQuery and SVG don't play nice)
      container.html(container.html());
      
      // Center text elements
      container.find("text").each(function(){
        var width = $(this)[0].getBBox().width;
        var x = $(this).attr("x");
        $(this).attr("x",x - width/2);
      });
      
      //Resolve collisions and adjust viewBox:
      var extremeBounds = resolveCollisions(container);
      var PADDING = 5
      container.find('svg')[0].setAttribute("viewBox", [
        (extremeBounds.left-PADDING),
        (extremeBounds.top-PADDING),
        (extremeBounds.right-extremeBounds.left+PADDING*2),
        (extremeBounds.bottom-extremeBounds.top+PADDING*2)
      ].join(" "));
      
      // Define hovering behavior
      container.find("path.main").on("mouseover", function(){
        var group = $(this).attr("group");
        container.find(".main").css("opacity",0);
        container.find("path.main").css("opacity",0.125);
        $(this).css("opacity",0);
        container.find(".sub[group='"+group+"']").css("opacity",1);
      }).on("mouseout", function(){
        container.find(".main").css("opacity",1);
        container.find(".sub").css("opacity",0);
      });
      
      
    }
    
    function drawSectors(container, shares, labels, colors, cssClass, grouping, offset) {
      var TAU = Math.PI*2;
      if (shares.length && shares[0] === 1) {
        shares[0] = 0.9999;
      }
      if (offset) {
        shares.unshift(offset);
        labels.unshift("!!!"); // This should never actually appear in the view.
      }
      
      
      var boundaries = [];
      var sum = 0;
      var i;
      for (i=0; i<shares.length; i++) {
        boundaries.push(shares[i]+sum);
        sum += shares[i];
      }
      var boundaryAngles = boundaries.map(function(x){return x*TAU;});
      
      var midpoints = [];
      for (i=0; i<shares.length; i++) {
        midpoints.push((boundaries[i-1]||0) + shares[i]/2);
      }
      var midpointAngles = midpoints.map(function(x){return x*TAU;});
      
      var center = [SIZE/2,SIZE/2];
      var circleRadius = SIZE/2;
      
      var polarToRect = function(radius, angle) {
        return [
          center[0]+radius*Math.sin(angle), 
          center[1]-radius*Math.cos(angle)
        ];
      };
      
      
      var sectors = [];
      for ((offset ? i=1 : i=0); i<shares.length; i++) {
        var share = shares[i];
        if (share !== 0) {
          var pointA = polarToRect(circleRadius, boundaryAngles[i-1]||0);
          var pointB = polarToRect(circleRadius, boundaryAngles[i]);
          var labelCoords = polarToRect(circleRadius+20, midpointAngles[i]);
          var labelPosition = {
            x: labelCoords[0],
            y: labelCoords[1]
          };
          
          sectors.push({
            path: "M "+center.join(",")+
              " L "+pointA.join(",")+
              " A "+circleRadius+","+circleRadius+
              " 0,"+(shares[i]>0.5?"1":"0")+",1 "+
              pointB.join(",")+" Z",
            color: colors[sectors.length % colors.length],
            labelPosition: labelPosition,
            labelText: labels[i],
            group: "string"===typeof(grouping) ? grouping : grouping[i], //TODO move this out to make it more efficient
            share: share
          });
        }
      }

      var svg = container.find('svg').attr({
        width: "100%",
        height: SIZE*19/12,
        "xmlns:svg": "http://www.w3.org/2000/svg",
        "xmlns":     "http://www.w3.org/2000/svg"
      });
      
      var sector;
      for (i=0; i<sectors.length; i++) {
        sector = sectors[i];
        
        $('<path></path>').appendTo(svg).attr({
          fill: sector.color,
          stroke: sector.color,
          d: sector.path,
          "class": cssClass,
          group: sector.group
        });
      }

      for (i=0; i<sectors.length; i++) {
        sector = sectors[i];
        
        var g = $('<g></g>').appendTo(svg).attr({
          "class": cssClass + " pielabel",
          group: sector.group
        });
        
        $('<text></text>').appendTo(g).text(sector.labelText).attr({
          x: sector.labelPosition.x,
          y: sector.labelPosition.y,
          "class": cssClass,
          group: sector.group
        });
        
        $('<text></text>').appendTo(g).text(Math.round(sector.share*100)+"%").attr({
          "class": cssClass + " percentage",
          x: sector.labelPosition.x,
          y: sector.labelPosition.y+14,
          group: sector.group
        });
      }
    }

    function resolveCollisions(container) {
      var svg = container.find('svg');
      var bounds = [];

      var iterations=0, mainBounds, changed, temp;
      do {
        temp = resolveCollisionsInSelection(svg.find("g.main.pielabel"));
        mainBounds = temp[0];
        changed = temp[1];
        iterations++;
      } while (changed && iterations<10);
      bounds.push(mainBounds);
      
      var groups = {};
      svg.find("g.sub.pielabel").each(function(){
        groups[$(this).attr("group")] = true;
      });
      var okg = Object.keys(groups);
      var i;
      var groupBounds;
      for (i=0; i<okg.length; i++) {
        var group = okg[i];
        var selection = svg.find("g.sub.pielabel[group='"+group+"']");
        iterations = 0;
        do {
          temp = resolveCollisionsInSelection(selection);
          groupBounds = temp[0];
          changed = temp[1];
          iterations++;
        } while (changed && iterations<10);
        bounds.push(groupBounds);
      }
      return findExtremeBounds(bounds);
    }
    
    function findExtremeBounds(bounds) {
      var extrema = {
        left:    0,
        right:  SIZE,
        top:     0,
        bottom: SIZE
      };
      
      for (var i=0; i<bounds.length; i++) {
        var bound = bounds[i];
        extrema = {
          left:   Math.min(extrema.left, bound.left),
          right:  Math.max(extrema.right, bound.right),
          top:    Math.min(extrema.top, bound.top),
          bottom: Math.max(extrema.bottom, bound.bottom)
        };
      }
      return extrema;
    }
    
    function resolveCollisionsInSelection(selection) {
      var bounds = [];
      selection.each(function(){
        var bbox = $(this)[0].getBBox();
        bounds.push({
          left:   bbox.x,
          right:  bbox.x+bbox.width,
          top:    bbox.y,
          bottom: bbox.y+bbox.height
        });
      });
      var collisions = {};
      var collider, collidee;
      for (collider=0; collider<bounds.length; collider++) {
        var colliderBounds = bounds[collider];
        for (collidee=0; collidee<bounds.length; collidee++) { if (collider !== collidee) {
          var collideeBounds = bounds[collidee];
          var collisionLR = colliderBounds.right - collideeBounds.left;
          var collisionRL = colliderBounds.left - collideeBounds.right;
          var collisionTB = colliderBounds.bottom - collideeBounds.top;
          var collisionBT = colliderBounds.top - collideeBounds.bottom;
          
          if (collisionLR > 0 && collisionRL < 0 && collisionTB > 0 && collisionBT < 0) {
            if (!collisions[collider]) {
              collisions[collider] = {};
            }
            if (!collisions[collider][collidee]) {
              collisions[collider][collidee] = {};
            }
            collisions[collider][collidee] = {
              x: (collisionLR > -collisionRL ? collisionRL : collisionLR),
              y: (collisionTB > -collisionBT ? collisionBT : collisionTB)
            };
          }
        }}
      }
      
      
      function adjustBy(collision, coordinate) {
        return function() {
          var t = $(this).attr(coordinate);
          var adjustment = collision[coordinate];
          $(this).attr(coordinate,t-adjustment/1.9);
        }
      }
      
      
      for (collider in collisions) {if (collisions.hasOwnProperty(collider)) {
        var collidingWith = collisions[collider];
        for (collidee in collidingWith) {if (collidingWith.hasOwnProperty(collidee)) {
          var collision = collidingWith[collidee];
          var g = $(selection[collider]);
          if (false || Math.abs(collision.x) < Math.abs(collision.y)) { //TODO: Be smarter about this
            g.find("text").each(adjustBy(collision,"x"));
          } else {
            g.find("text").each(adjustBy(collision,"y"));
          }
        }}
      }}
            
      return [
        findExtremeBounds(bounds),
        !!(Object.keys(collisions).length)
      ];
    }
    
    
    drawPieChart(element, scope.exchangeRates, scope.drops, scope.ious);
  }
  
  return {
    restrict: 'E',
    scope: {
      drops: '=rpDrops',
      ious: '=rpIous',
      exchangeRates: '=rpExchangeRates',
      size: '@rpSize'
    },
    link: function(scope, element, attributes) {
      pieChart(element, scope),
      scope.$watch('drops', function() {
        pieChart(element, scope);
      });
      
      scope.$on('$balancesUpdate', function() {
        pieChart(element, scope);
      });
      
      scope.$watch('exchangeRates', function() {
        pieChart(element, scope);
      }, true);
    }
  };
}]); 



