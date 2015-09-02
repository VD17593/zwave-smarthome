/**
 * Application Zwave controller
 * @author Martin Vach
 */

/**
 * Zwave add controller
 */
myAppController.controller('ZwaveAddController', function($scope, $routeParams, dataFactory, dataService, _) {
    $scope.zwaveDevices = [];
    $scope.deviceVendor = false;
    $scope.manufacturers = [];
    $scope.manufacturer = false;
    /**
     * Load z-wave devices
     */
    $scope.loadData = function(brandname, lang) {
        dataService.showConnectionSpinner();
        dataFactory.getApiLocal('device.' + lang + '.json').then(function(response) {
            $scope.manufacturers = _.uniq(response.data, 'brandname');
            if (brandname) {
                $scope.zwaveDevices = _.where(response.data, {brandname: brandname});
                $scope.manufacturer = brandname;
            }
            dataService.updateTimeTick();
        }, function(error) {
            dataService.showConnectionError(error);
        });
    };
    $scope.loadData($routeParams.brandname, $scope.lang);
});
/**
 * Zwave include controller
 */
myAppController.controller('ZwaveIncludeController', function($scope, $routeParams, $interval, $filter,$route, dataFactory, dataService, myCache) {
    $scope.apiDataInterval = null;
    $scope.includeDataInterval = null;
    $scope.device = {
        'data': null
    };
    $scope.controllerState = 0;
    $scope.zwaveApiData = [];
    $scope.includedDeviceId = null;
    $scope.lastIncludedDevice = null;
    $scope.lastExcludedDevice = null;
    $scope.deviceFound = false;
    $scope.checkInterview = false;
    $scope.hasBattery = false;
    $scope.inclusionError = false;
    $scope.clearStepStatus = false;
    $scope.interviewCfg = {
        commandClassesCnt: 0,
        time: 0,
        stop: 0,
        isDone: []
    };

    $scope.nodeId = null;
    $scope.updateDevices = false;
    $scope.zWaveDevice = [];
    $scope.devices = [];
    $scope.dev = [];
    
    $scope.formInput = {
        elements: {},
        room: undefined
    };
    $scope.rooms = [];
    $scope.modelRoom;
    // Cancel interval on page destroy
    $scope.$on('$destroy', function() {
        $interval.cancel($scope.apiDataInterval);
        $interval.cancel($scope.includeDataInterval);
    });

    /**
     * Load data into collection
     */
    $scope.loadData = function(lang) {
        dataService.showConnectionSpinner();
        if (angular.isDefined($routeParams.device)) {
            dataFactory.getApiLocal('device.' + lang + '.json').then(function(response) {
                angular.forEach(response.data, function(v, k) {
                    if (v.id == $routeParams.device) {
                        $scope.device.data = v;
                        return;
                    }
                });

            }, function(error) {
                dataService.showConnectionError(error);
                return;
            });
        }
        return;
    };
    $scope.loadData($scope.lang);

    /**
     * Load data into collection
     */
    $scope.loadZwaveApiData = function() {
        
         dataFactory.loadZwaveApiData(true).then(function(ZWaveAPIData) {
              $scope.controllerState = ZWaveAPIData.controller.data.controllerState.value;
            var refresh = function() {
                dataFactory.refreshZwaveApiData().then(function(response) {
                    checkController(response.data, response.data);
                    dataService.updateTimeTick(response.data.updateTime);
                }, function(error) {
                    dataService.showConnectionError(error);
                    return;
                });
            };
            $scope.apiDataInterval = $interval(refresh, $scope.cfg.interval);
        }, function(error) {
            dataService.showConnectionError(error);
            return;
        });
        
        
//        dataFactory.loadZwaveApiData().then(function(ZWaveAPIData) {
//            var refresh = function() {
//                dataFactory.joinedZwaveData(ZWaveAPIData).then(function(response) {
//                    checkController(response.data.update, response.data.joined);
//                    dataService.updateTimeTick(response.data.update.updateTime);
//                }, function(error) {
//                    dataService.showConnectionError(error);
//                    return;
//                });
//            };
//            $scope.apiDataInterval = $interval(refresh, $scope.cfg.interval);
//        }, function(error) {
//            dataService.showConnectionError(error);
//            return;
//        });
    };
    $scope.loadZwaveApiData();
    /**
     * Watch for last excluded device
     */
    $scope.$watch('includedDeviceId', function() {
        if ($scope.includedDeviceId) {
            var refresh = function() {
                $scope.deviceFound = false;
                $scope.checkInterview = true;
                dataFactory.loadZwaveApiData(true).then(function(ZWaveAPIData) {
                    //dataFactory.joinedZwaveData($scope.zwaveApiData).then(function(response) {
                    //var ZWaveAPIData = response.data.joined;
                    //var ZWaveAPIData = response;
                    var nodeId = $scope.includedDeviceId;
                    var node = ZWaveAPIData.devices[nodeId];
                    if (!node) {
                        return;
                    }
                    var interviewDone = true;
                    //var instanceId = 0;
                    var hasBattery = false;
                    if (angular.isDefined(ZWaveAPIData.devices[nodeId].instances)) {
                        hasBattery = 0x80 in ZWaveAPIData.devices[nodeId].instances[0].commandClasses;
                    }
                    //var vendor = ZWaveAPIData.devices[nodeId].data.vendorString.value;
                    //var deviceType = ZWaveAPIData.devices[nodeId].data.deviceTypeString.value;
                    $scope.hasBattery = hasBattery;

                    //console.log('CHECK interview -----------------------------------------------------')
                    // Check interview
                    if (ZWaveAPIData.devices[nodeId].data.nodeInfoFrame.value && ZWaveAPIData.devices[nodeId].data.nodeInfoFrame.value.length) {
                        for (var iId in ZWaveAPIData.devices[nodeId].instances) {
                            if (Object.keys(ZWaveAPIData.devices[nodeId].instances[iId].commandClasses).length > 0) {
                                $scope.interviewCfg.commandClassesCnt = Object.keys(ZWaveAPIData.devices[nodeId].instances[iId].commandClasses).length;
                                if ($scope.interviewCfg.stop === 0) {
                                    // Wait 20 seconds after interview start check
                                    $scope.interviewCfg.time = (Math.round(+new Date() / 1000)) + 20;
                                }
                                $scope.interviewCfg.stop = (Math.round(+new Date() / 1000));
                                for (var ccId in ZWaveAPIData.devices[nodeId].instances[iId].commandClasses) {
                                    var notInterviewClass = 'devices.' + nodeId + '.instances.' + iId + '.commandClasses.' + ccId + '.data.interviewDone.value';
                                    // Interview is not done
                                    if (!ZWaveAPIData.devices[nodeId].instances[iId].commandClasses[ccId].data.interviewDone.value) {
                                        interviewDone = false;
                                    } else {  // Interview is done
                                        if ($scope.interviewCfg.isDone.indexOf(notInterviewClass) === -1) {
                                            $scope.interviewCfg.isDone.push(notInterviewClass);
                                        }
                                    }
                                }
                            } else {
                                interviewDone = false;
                            }
                        }

                    } else {
                        interviewDone = false;
                    }
                    if (interviewDone) {
                        $scope.lastIncludedDevice = node.data.givenName.value || 'Device ' + '_' + nodeId;
                        myCache.remove('devices');
                        $scope.includedDeviceId = null;
                        $scope.checkInterview = false;
                        $interval.cancel($scope.includeDataInterval);
                        $scope.nodeId = nodeId;
                        $scope.loadLocations();
                        $scope.loadElements(nodeId);


                    } else {
                        $scope.checkInterview = true;
                    }


                }, function(error) {
                    $scope.inclusionError = true;
                    dataService.showConnectionError(error);
                });
            };
            $scope.includeDataInterval = $interval(refresh, $scope.cfg.interval);

        }
    });

    /**
     * Watch for last excluded device
     */
    $scope.$watch('updateDevices', function() {
        if ($scope.nodeId) {
            $scope.updateDevices = false;
            $scope.loadElements($scope.nodeId);
        }
    });

    /**
     * Watch for last excluded device
     */
    //$scope.$watch('interviewCfg', function() {});
    
    /**
     * Retry inclusion
     */
    $scope.retryInclusion = function() {
         myCache.removeAll();
        $route.reload();
        $scope.runZwaveCmd('controller.RemoveNodeFromNetwork(1)');
    };


    /**
     * Run ExpertUI command
     */
    $scope.runZwaveCmd = function(cmd) {
        $scope.lastIncludedDevice = null;
        $scope.lastExcludedDevice = null;
        dataFactory.runZwaveCmd(cmd).then(function() {
            //myCache.remove('devices');
            myCache.removeAll();
            //console.log('Reload...')
        $route.reload();
        }, function(error) {
        });

    };

    /**
     * Load data
     */
    $scope.loadElements = function(nodeId) {
        //console.log('Loading nodeId',nodeId)
        dataService.showConnectionSpinner();
        dataFactory.getApi('devices').then(function(response) {
            zwaveApiData(nodeId, response.data.data.devices);

        }, function(error) {
            dataService.showConnectionError(error);
        });
    };

    /**
     * Load locations
     */
    $scope.loadLocations = function() {
        dataFactory.getApi('locations').then(function(response) {
            $scope.rooms = response.data.data;
        }, function(error) {
            dataService.showConnectionError(error);
        });
    }
    ;


    /**
     * Assign devices to room
     */
    $scope.devicesToRoom = function(roomId, devices) {
        if (!roomId) {
            return;
        }
        $scope.loading = {status: 'loading-spin', icon: 'fa-spinner fa-spin', message: $scope._t('updating')};
        for (var i = 0; i <= devices.length; i++) {
            var v = devices[i];
            if (!v) {
                continue;
            }
            var input = {
                id: v.id,
                location: roomId
            };
            dataFactory.putApi('devices', v.id, input).then(function(response) {
            }, function(error) {
                alert($scope._t('error_update_data'));
                $scope.loading = false;
                return;
            });
        }
        myCache.remove('devices');
        $scope.loadData();
        $scope.loading = false;
        return;

    };
     /**
     * Update all devices
     */
    $scope.updateAllDevices = function() {
        $scope.loading = {status: 'loading-spin', icon: 'fa-spinner fa-spin', message: $scope._t('updating')};
       angular.forEach($scope.formInput.elements, function(v, k) {
                dataFactory.putApi('devices', v.id, v).then(function(response) {
                }, function(error) {});
        });
        myCache.remove('devices');
        $scope.updateDevices = true;
       //$scope.loadData($routeParams.nodeId);
       $scope.loading = false;

    };
    /**
     * Update device
     */
    $scope.updateDevice = function(input) {
        $scope.loading = {status: 'loading-spin', icon: 'fa-spinner fa-spin', message: $scope._t('updating')};
        dataFactory.putApi('devices', input.id, input).then(function(response) {
            myCache.remove('devices');
            //$scope.loadData($scope.nodeId);
            $scope.updateDevices = true;
            $scope.loading = false;
        }, function(error) {
            alert($scope._t('error_update_data'));
            $scope.loading = false;
        });

    };

    /// --- Private functions --- ///
    /**
     * Check controller data data
     */
    function checkController(data, ZWaveAPIData) {
        //var data = response.data;
        if ('controller.data.controllerState' in data) {
            $scope.controllerState = data['controller.data.controllerState'].value;
            console.log('controllerState: ', $scope.controllerState)
        }

        if ('controller.data.lastExcludedDevice' in data) {
            $scope.lastExcludedDevice = data['controller.data.lastExcludedDevice'].value;
            console.log('lastExcludedDevice: ', $scope.lastExcludedDevice)
        }
        if ('controller.data.lastIncludedDevice' in data) {
            var deviceIncId = data['controller.data.lastIncludedDevice'].value;
            if (deviceIncId != null) {
                var givenName = 'Device_' + deviceIncId;
                var cmd = 'devices[' + deviceIncId + '].data.givenName.value=\'' + givenName + '\'';
                dataFactory.runZwaveCmd(cmd).then(function() {
                    $scope.includedDeviceId = deviceIncId;
                    $scope.deviceFound = true;
                    //getLastIncluded(deviceIncId,ZWaveAPIData);
                }, function(error) {
                    dataService.showConnectionError(error);
                });

            }
        }
    }
    ;

    /**
     * Get last included device
     */
//    function getLastIncluded(nodeId, ZWaveAPIData) {
//        if (!$scope.includedDeviceId) {
//            return;
//        }
//        $scope.deviceFound = false;
//        $scope.checkInterview = true;
//        var node = ZWaveAPIData.devices[nodeId];
//        if (!node) {
//            return;
//        }
//        var interviewDone = true;
//        //var instanceId = 0;
//        var hasBattery = false;
//        if (angular.isDefined(ZWaveAPIData.devices[nodeId].instances)) {
//            hasBattery = 0x80 in ZWaveAPIData.devices[nodeId].instances[0].commandClasses;
//        }
//        $scope.hasBattery = hasBattery;
//
//        console.log('CHECK interview NEW -----------------------------------------------------')
//        // Check interview
//        if (ZWaveAPIData.devices[nodeId].data.nodeInfoFrame.value && ZWaveAPIData.devices[nodeId].data.nodeInfoFrame.value.length) {
//             console.log('ZWaveAPIData.devices[nodeId].instances',ZWaveAPIData.devices[nodeId].instances)
//            for (var iId in ZWaveAPIData.devices[nodeId].instances) {
//                if (Object.keys(ZWaveAPIData.devices[nodeId].instances[iId].commandClasses).length > 0) {
//                     console.log('ZWaveAPIData.devices[nodeId].instances[iId].commandClasses).length > 0 -----------------------------------------------------')
//                    $scope.interviewCfg.commandClassesCnt = Object.keys(ZWaveAPIData.devices[nodeId].instances[iId].commandClasses).length;
//                    if ($scope.interviewCfg.stop === 0) {
//                        // Wait 20 seconds after interview start check
//                        $scope.interviewCfg.time = (Math.round(+new Date() / 1000)) + 20;
//                    }
//                    $scope.interviewCfg.stop = (Math.round(+new Date() / 1000));
//                    for (var ccId in ZWaveAPIData.devices[nodeId].instances[iId].commandClasses) {
//                        var notInterviewClass = 'devices.' + nodeId + '.instances.' + iId + '.commandClasses.' + ccId + '.data.interviewDone.value';
//                        // Interview is not done
//                        if (!ZWaveAPIData.devices[nodeId].instances[iId].commandClasses[ccId].data.interviewDone.value) {
//                            interviewDone = false;
//                        } else {  // Interview is done
//                            if ($scope.interviewCfg.isDone.indexOf(notInterviewClass) === -1) {
//                                $scope.interviewCfg.isDone.push(notInterviewClass);
//                            }
//                        }
//                    }
//                } else {
//                    interviewDone = false;
//                }
//            }
//
//        } else {
//            interviewDone = false;
//        }
//        if (interviewDone) {
//            $scope.lastIncludedDevice = node.data.givenName.value || 'Device ' + '_' + nodeId;
//            myCache.remove('devices');
//            $scope.includedDeviceId = null;
//            $scope.checkInterview = false;
//            //$interval.cancel($scope.includeDataInterval);
//            $scope.nodeId = nodeId;
//            $scope.loadLocations();
//            $scope.loadElements(nodeId);
//
//
//        } else {
//            $scope.checkInterview = true;
//        }
//    }
//    ;

    /**
     * Get zwaveApiData
     */
    function zwaveApiData(nodeId, devices) {
        dataFactory.loadZwaveApiData().then(function(ZWaveAPIData) {
            dataService.updateTimeTick();
            var node = ZWaveAPIData.devices[nodeId];
            if (!node) {
                return;
            }

            $scope.zWaveDevice = {
                id: nodeId,
                title: node.data.givenName.value || 'Device ' + '_' + nodeId,
                cfg: []
            };
            // Has config file
            if (angular.isDefined(node.data.ZDDXMLFile) && node.data.ZDDXMLFile.value != '') {
                if ($scope.zWaveDevice['cfg'].indexOf('config') === -1) {
                    $scope.zWaveDevice['cfg'].push('config');
                }
            }
            // Has wakeup
            if (0x84 in node.instances[0].commandClasses) {
                if ($scope.zWaveDevice['cfg'].indexOf('wakeup') === -1) {
                    $scope.zWaveDevice['cfg'].push('wakeup');
                }
            }
            // Has SwitchAll
            if (0x27 in node.instances[0].commandClasses) {
                if ($scope.zWaveDevice['cfg'].indexOf('switchall') === -1) {
                    $scope.zWaveDevice['cfg'].push('switchall');
                }
            }
            // Has protection
            if (0x75 in node.instances[0].commandClasses) {
                if ($scope.zWaveDevice['cfg'].indexOf('protection') === -1) {
                    $scope.zWaveDevice['cfg'].push('protection');
                }
            }
            if ($scope.devices.length > 0) {
                $scope.devices = angular.copy([]);
            }
            var findZwaveStr = "ZWayVDev_zway_";
            angular.forEach(devices, function(v, k) {
                if (v.id.indexOf(findZwaveStr) === -1 || v.deviceType === 'battery') {
                    return;
                }
                var cmd = v.id.split(findZwaveStr)[1].split('-');
                var zwaveId = cmd[0];
                var iId = cmd[1];
                var ccId = cmd[2];
                if (zwaveId == nodeId) {
                    var obj = {};
                    obj['id'] = v.id;
                    obj['permanently_hidden'] = v.permanently_hidden;
                    obj['visibility'] = v.visibility;
                    obj['level'] = $filter('toInt')(v.metrics.level);
                    obj['metrics'] = v.metrics;
                    $scope.formInput.elements[v.id] = obj;
                    $scope.devices.push(obj);
                }

            });
        }, function(error) {
            dataService.showConnectionError(error);
        });
    }
    ;


});
/**
 * Zwave manage controller
 */
myAppController.controller('ZwaveManageController', function($scope, $cookies, $filter, $window, $location, dataFactory, dataService, myCache) {
    $scope.activeTab = (angular.isDefined($cookies.tab_network) ? $cookies.tab_network : 'battery');
    $scope.batteries = {
        'list': [],
        'cntLess20': [],
        'cnt0': []
    };
    $scope.devices = {
        'failed': [],
        'batteries': [],
        'zwave': []
    };
    $scope.goEdit = [];
    $scope.zWaveDevices = {};

//    $scope.modelName = [];
//    $scope.modelRoom = {};
//
//    $scope.rooms = [];
    /**
     * Set tab
     */
    $scope.setTab = function(tabId) {
        $scope.activeTab = tabId;
        $cookies.tab_network = tabId;
    };


    /**
     * Load data
     */
    $scope.loadData = function() {
        dataService.showConnectionSpinner();
        dataFactory.getApi('devices').then(function(response) {
            zwaveApiData(response.data.data.devices);
            loadLocations();

        }, function(error) {
            $location.path('/error/' + error.status);
        });
    };
    $scope.loadData();

    /// --- Private functions --- ///
    /**
     * Load locations
     */
    function loadLocations() {
        dataFactory.getApi('locations').then(function(response) {
            $scope.rooms = response.data.data;
        }, function(error) {
            dataService.showConnectionError(error);
        });
    }
    ;
    /**
     * Get zwaveApiData
     */
    function zwaveApiData(devices) {
        dataFactory.loadZwaveApiData().then(function(ZWaveAPIData) {
            dataService.updateTimeTick();
            if (!ZWaveAPIData.devices) {
                return;
            }

            angular.forEach(ZWaveAPIData.devices, function(v, k) {
                if (k == 1) {
                    return;
                }

                $scope.zWaveDevices[k] = {
                    id: k,
                    title: v.data.givenName.value || 'Device ' + '_' + k,
                    icon: null,
                    cfg: [],
                    elements: [],
                    messages: []
                };

            });
            var findZwaveStr = "ZWayVDev_zway_";
            angular.forEach(devices, function(v, k) {
                var cmd;
                var nodeId;
                var iId;
                var ccId;
                if (v.id.indexOf(findZwaveStr) > -1) {
                    cmd = v.id.split(findZwaveStr)[1].split('-');
                    nodeId = cmd[0];
                    iId = cmd[1];
                    ccId = cmd[2];
                    var node = ZWaveAPIData.devices[nodeId];
                    if (node) {
                        var interviewDone = isInterviewDone(node, nodeId);
                        var isFailed = node.data.isFailed.value;
                        var hasBattery = 0x80 in node.instances[0].commandClasses;
                        var obj = {};
                        obj['id'] = v.id;
                        obj['visibility'] = v.visibility;
                        obj['permanently_hidden'] = v.permanently_hidden;
                        obj['nodeId'] = nodeId;
                        obj['nodeName'] = node.data.givenName.value || 'Device ' + '_' + k,
                                obj['title'] = v.metrics.title;
                        obj['deviceType'] = v.deviceType;
                        obj['level'] = $filter('toInt')(v.metrics.level);
                        obj['metrics'] = v.metrics;
                        obj['messages'] = [];
                        if (v.deviceType !== 'battery') {
                            $scope.devices.zwave.push(obj);
                            $scope.zWaveDevices[nodeId]['elements'].push(obj);
                            $scope.zWaveDevices[nodeId]['icon'] = obj.metrics.icon;
                        }

                        // Batteries
                        if (v.deviceType === 'battery') {
                            $scope.devices.batteries.push(obj);
                        }
                        if (hasBattery && interviewDone) {
                            var batteryCharge = parseInt(node.instances[0].commandClasses[0x80].data.last.value);
                            if (batteryCharge <= 20) {
                                $scope.zWaveDevices[nodeId]['messages'].push({
                                    type: 'battery',
                                    error: $scope._t('lb_low_battery') + ' (' + batteryCharge + '%)'
                                });
                                obj['messages'].push({
                                    type: 'battery',
                                    error: $scope._t('lb_low_battery') + ' (' + batteryCharge + '%)'
                                });
                            }
                        }
                        // Not interview
                        if (!interviewDone) {
                            $scope.zWaveDevices[nodeId]['messages'].push({
                                type: 'config',
                                error: $scope._t('lb_not_configured')

                            });

                            obj['messages'].push({
                                type: 'config',
                                error: $scope._t('lb_not_configured')

                            });
                        }
                        // Is failed
                        if (isFailed) {
                            $scope.zWaveDevices[nodeId]['messages'].push({
                                type: 'failed',
                                error: $scope._t('lb_is_failed')

                            });
                            obj['messages'].push({
                                type: 'failed',
                                error: $scope._t('lb_is_failed')

                            });
                        }
                        $scope.devices.failed.push(obj);
                    }

                }
            });
            // Count device batteries
            for (i = 0; i < $scope.devices.batteries.length; ++i) {
                var battery = $scope.devices.batteries[i];
                if (battery.level < 1) {
                    $scope.batteries.cnt0.push(battery.id);
                }
                if (battery.level > 0 && battery.level < 20) {
                    $scope.batteries.cntLess20.push(battery.id);
                }

            }
        }, function(error) {
            $location.path('/error/' + error.status);
        });
    }
    ;

    
    /**
     * notInterviewDevices
     */
    function isInterviewDone(node, nodeId) {
        for (var iId in node.instances) {
            for (var ccId in node.instances[iId].commandClasses) {
                var isDone = node.instances[iId].commandClasses[ccId].data.interviewDone.value;
                if (isDone == false) {
                    return false;
                }
            }
        }
        return true;

    }
    ;
});
/**
 * Profile controller
 */
myAppController.controller('ZwaveManageIdController', function($scope, $routeParams, $filter, $location, dataFactory, dataService, myCache) {
    $scope.zWaveDevice = [];
    $scope.devices = [];
    //$scope.dev = [];
    $scope.formInput = {
        elements: {},
        room: undefined
    };
    $scope.rooms = [];
    //$scope.modelRoom;

    /**
     * Load data
     */
    $scope.loadData = function(nodeId) {
        dataService.showConnectionSpinner();
        dataFactory.getApi('devices').then(function(response) {
            zwaveApiData(nodeId, response.data.data.devices);
            loadLocations();

        }, function(error) {
            $location.path('/error/' + error.status);
        });
    };
    $scope.loadData($routeParams.nodeId);

    /**
     * Assign devices to room
     */
    $scope.devicesToRoom = function(roomId, devices) {
        if (!roomId) {
            return;
        }
        $scope.loading = {status: 'loading-spin', icon: 'fa-spinner fa-spin', message: $scope._t('updating')};
        for (var i = 0; i <= devices.length; i++) {
            var v = devices[i];
            if (!v) {
                continue;
            }
            var input = {
                id: v.id,
                location: roomId
            };

            dataFactory.putApi('devices', v.id, input).then(function(response) {
            }, function(error) {
                alert($scope._t('error_update_data'));
                $scope.loading = false;
                return;
            });
        }
        myCache.remove('devices');
        $scope.loadData($routeParams.nodeId);
        $scope.loading = false;
        return;

    };

    /**
     * Update all devices
     */
    $scope.updateAllDevices = function() {
        $scope.loading = {status: 'loading-spin', icon: 'fa-spinner fa-spin', message: $scope._t('updating')};
       angular.forEach($scope.formInput.elements, function(v, k) {
                var errors = 0;
                dataFactory.putApi('devices', v.id, v).then(function(response) {
                }, function(error) {});
        });
        myCache.remove('devices');
       $scope.loadData($routeParams.nodeId);
       $scope.loading = false;

    };
    /**
     * Update single device
     */
    $scope.updateDevice = function(input) {
        $scope.loading = {status: 'loading-spin', icon: 'fa-spinner fa-spin', message: $scope._t('updating')};
        dataFactory.putApi('devices', input.id, input).then(function(response) {
            myCache.remove('devices');
            $scope.loadData($routeParams.nodeId);
            $scope.loading = false;
        }, function(error) {
            alert($scope._t('error_update_data'));
            $scope.loading = false;
        });

    };

    /// --- Private functions --- ///
    /**
     * Load locations
     */
    function loadLocations() {
        dataFactory.getApi('locations').then(function(response) {
            $scope.rooms = response.data.data;
        }, function(error) {
            dataService.showConnectionError(error);
        });
    }
    ;
    /**
     * Get zwaveApiData
     */
    function zwaveApiData(nodeId, devices) {
        dataFactory.loadZwaveApiData().then(function(ZWaveAPIData) {
            dataService.updateTimeTick();
            var node = ZWaveAPIData.devices[nodeId];
            if (!node) {
                $location.path('/error/404');
                return;
            }

            $scope.zWaveDevice = {
                id: nodeId,
                title: node.data.givenName.value || 'Device ' + '_' + nodeId,
                cfg: []
            };
            // Has config file
            if (angular.isDefined(node.data.ZDDXMLFile) && node.data.ZDDXMLFile.value != '') {
                if ($scope.zWaveDevice['cfg'].indexOf('config') === -1) {
                    $scope.zWaveDevice['cfg'].push('config');
                }
            }
            // Has wakeup
            if (0x84 in node.instances[0].commandClasses) {
                if ($scope.zWaveDevice['cfg'].indexOf('wakeup') === -1) {
                    $scope.zWaveDevice['cfg'].push('wakeup');
                }
            }
            // Has SwitchAll
            if (0x27 in node.instances[0].commandClasses) {
                if ($scope.zWaveDevice['cfg'].indexOf('switchall') === -1) {
                    $scope.zWaveDevice['cfg'].push('switchall');
                }
            }
            // Has protection
            if (0x75 in node.instances[0].commandClasses) {
                if ($scope.zWaveDevice['cfg'].indexOf('protection') === -1) {
                    $scope.zWaveDevice['cfg'].push('protection');
                }
            }
            if ($scope.devices.length > 0) {
                $scope.devices = angular.copy([]);
            }
            var findZwaveStr = "ZWayVDev_zway_";
            angular.forEach(devices, function(v, k) {
                if (v.id.indexOf(findZwaveStr) === -1 || v.deviceType === 'battery') {
                    return;
                }
                var cmd = v.id.split(findZwaveStr)[1].split('-');
                var zwaveId = cmd[0];
                var iId = cmd[1];
                var ccId = cmd[2];
                if (zwaveId == nodeId) {
                    var obj = {};
                    obj['id'] = v.id;
                    obj['permanently_hidden'] = v.permanently_hidden;
                    obj['visibility'] = v.visibility;
                    obj['level'] = $filter('toInt')(v.metrics.level);
                    obj['metrics'] = v.metrics;
                    $scope.formInput.elements[v.id] = obj;
                    $scope.devices.push(obj);
                }

            });
        }, function(error) {
            $location.path('/error/404');
        });
    }
    ;


});