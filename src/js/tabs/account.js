var util = require('util');
var Tab = require('../client/tab').Tab;

var AccountTab = function ()
{
  Tab.call(this);
};

util.inherits(AccountTab, Tab);

AccountTab.prototype.tabName = 'account';
AccountTab.prototype.mainMenu = 'account';

AccountTab.prototype.generateHtml = function ()
{
  return require('../../jade/tabs/account.jade')();
};

AccountTab.prototype.angular = function(module)
{
  module.controller('AccountCtrl', ['$scope', 'rpId', 'rpKeychain',
    function ($scope, $id, keychain)
    {
      if (!$id.loginStatus) return $id.goId();

      $scope.rename = function() {
        $scope.loading = true;
        $scope.error = false;

        // Get the master key
        keychain.getSecret($id.account, $id.username, $scope.password,
          function (err, masterkey) {
            if (err) {
              console.log("client: account tab: error while " +
                "unlocking wallet: ", err);

              $scope.error = 'wrongpassword';
              $scope.loading = false;
              return;
            }

            // Rename
            $id.rename({
              new_username: $scope.username,
              password: $scope.password,
              masterkey: masterkey
            }, function(err){
              if (err) {
                console.log('client: account tab: error while ' +
                  'renaming account: ', err);
                $scope.error = true;
                $scope.loading = false;
                return;
              }

              // Re-login
              // TODO implement refresh/relogin in ID.
              $id.login({
                username: $scope.username,
                password: $scope.password
              }, function (err) {
                if (err) {
                  console.log('client: account tab: error while ' +
                    'logging user in: ', err);
                  $scope.error = 'cantlogin';
                  $scope.loading = false;
                  return;
                }

                $scope.success = true;
                reset();
              });
            });
          }
        );
      };

      $scope.changePassword = function() {
        $scope.loading = true;
        $scope.error = false;

        // Get the master key
        keychain.getSecret($id.account, $id.username, $scope.password,
          function (err, masterkey) {
            if (err) {
              console.log("client: account tab: error while " +
                "unlocking wallet: ", err);

              $scope.error = 'wrongpassword';
              $scope.loading = false;
              return;
            }

            // Change password
            $id.changePassword({
              username: $id.username,
              password: $scope.password1,
              masterkey: masterkey,
              blob: $scope.userBlob
            }, function(err){
              if (err) {
                console.log('client: account tab: error while ' +
                  'changing the account password: ', err);
                $scope.error = true;
                $scope.loading = false;
                return;
              }

              $scope.success = true;
              reset();
            });
          }
        );
      };

      var reset = function() {
        $scope.openForm = false;
        $scope.username = '';
        $scope.password = '';
        $scope.showPassword = true;
        $scope.success = false;
        $scope.loading = false;
        $scope.error = false;

        if ($scope.renameForm) {
          $scope.renameForm.$setPristine(true);
        }

        $scope.openFormPassword = false;
        $scope.password1 = '';
        $scope.password2 = '';
        $scope.passwordSet = {};

        if ($scope.changeForm) {
          $scope.changeForm.$setPristine(true);
        } 
      };

      reset();
    }]
  );
};

module.exports = AccountTab;



