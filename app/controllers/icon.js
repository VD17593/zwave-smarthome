/**
 * @overview Controllers that handle all custom icon actions – displays and uploads.
 * @author Martin Vach
 */

/**
 * The controller that renders and upload icons.
 * @class CustomIconController
 */
myAppController.controller('CustomIconController', function ($scope,$filter, cfg,dataFactory, dataService, _) {
    $scope.icons = {
        find: {},
        upload: false,
        all: {},
        info: {
            maxSize: $filter('fileSizeString')(cfg.upload.icon.size),
            extensions: cfg.upload.icon.extension.toString()
        }
    };
    /**
     *  Load icons
     */
    $scope.loadIcons = function () {
       // Atempt to load data
        dataFactory.getApiLocal('icons.json').then(function (response) {
            $scope.icons.all = response.data.data;
        }, function (error) {
            alertify.alertError($scope._t('error_load_data'));
            $scope.loading = false;
        });

    };
    $scope.loadIcons();
    
    /**
     * Upload an image file
     * @param {object} files
     * @returns {undefined}
     */
    $scope.uploadFile = function (files) {
        // Check allowed file formats
        //if(cfg.upload.room.type.indexOf(files[0].type) === -1){
        if (cfg.upload.icon.extension.indexOf($filter('fileExtension')(files[0].name)) === -1) {
            alertify.alertError(
                    $scope._t('upload_format_unsupported', {'__extension__': $filter('fileExtension')(files[0].name)}) + ' ' +
                    $scope._t('upload_allowed_formats', {'__extensions__': $scope.icons.info.extensions})
                    );
            return;

        }
        // Check allowed file size
        if (files[0].size > cfg.upload.icon.size) {
            alertify.alertError(
                    $scope._t('upload_allowed_size', {'__size__': $scope.icons.info.maxSize}) + ' ' +
                    $scope._t('upload_size_is', {'__size__': $filter('fileSizeString')(files[0].size)})
                    );
            return;

        }
        $scope.loading = {status: 'loading-spin', icon: 'fa-spinner fa-spin', message: $scope._t('uploading')};
        // Clear all alerts and file name selected
        alertify.dismissAll();
        $scope.icons.upload = false;
        // Set local variables
        var icon = $scope.icons.find,
            fd = new FormData();
        //var cmd = $scope.cfg.api_url + 'upload/file';
        // Set selected file name
        $scope.icons.upload = files[0].name;
        // Set form data
        fd.append('files_files', files[0]);
        // Atempt to upload a file
        dataFactory.getApiLocal('skins-online.json').then(function (response) {
            $scope.icons.find = {};
            var index = _.findIndex($scope.icons.all, function (v) {
                return v.id == icon.id
            });
            $timeout(function () {
                $scope.icons.all[index].custom = $scope.cfg.img.icons + files[0].name;
                $scope.loading = false;
                dataService.showNotifier({message: $scope._t('success_upload')});
            }, 2000);

        }, function (error) {
            scope.icons.find = {};
            alertify.alertError($scope._t('error_upload'));
            $scope.loading = false;
        });
    };
});