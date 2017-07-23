// ==UserScript==
// @name         WME Add City Helper
// @namespace    madnut.ua@gmail.com
// @version      0.1
// @description  Helps to add cities using WME Requests spreadsheet
// @author       madnut
// @include      https://www.waze.com/editor/*
// @include      https://www.waze.com/*/editor/*
// @include      https://editor-beta.waze.com/editor/*
// @include      https://editor-beta.waze.com/*/editor/*
// @connect      google.com
// @connect      script.googleusercontent.com
// @connect      localhost
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    var requestsTimeout = 15000; // in ms
    // prod
    var apiUrl = 'https://script.google.com/macros/s/AKfycby2OUnHmGkbTNeJDBcXu4zZ6eyNngh6XHpkcU_tsoVSmHn-NzY/exec';
    // dev
    //var apiUrl = 'https://script.google.com/macros/s/AKfycbxgluud2CmzFqpRm4Bp379UdEjuKhelt-0nT1feY_U/dev';

    var curRequest = {
        "author": "",
        "permalink": "",
        "requestedCity": "",
        "row": "",
        "note": "",
        "status": ""
    };
    var isRequestActive = false;

    function log(message) {
        if (typeof message === 'string') {
            console.log('ACH: ' + message);
        } else {
            console.log('ACH: ', message);
        }
    }

    function ACHelper_bootstrap() {
        if (typeof Waze === "undefined" ||
            typeof Waze.map === "undefined" ||
            typeof Waze.selectionManager === "undefined" ||
            typeof I18n === "undefined") {
            setTimeout(ACHelper_bootstrap, 1000);
            return;
        }
        ACHelper_init();

        Waze.selectionManager.events.register("selectionchanged", null, ACHelper_prepareUI);

        log("started");
    }

    function ACHelper_init() {

        var tooltipText = "Количество&nbsp;необработанных запросов&nbsp;НП.&nbsp;Нажмите, чтобы&nbsp;перейти&nbsp;к&nbsp;первому.";

        var $outputElemContainer = $('<div>', { id: 'achCountContainer',
                                               style: 'white-space:nowrap; cursor:pointer; position:relative; border-radius:23px; height:23px; display:inline; float:right; padding-left:10px; padding-right:10px; margin:9px 5px 8px 5px; font-weight:bold; font-size:medium;'});
        var $spinnerElem = $('<i>', { id: 'achSpinner',
                                     style: 'display:none; position:relative; left:-3px;',
                                     class: 'fa fa-spin fa-spinner' });
        var $outputElem = $('<span>', { id: 'achCount',
                                       click: getCityRequest,
                                       style: 'text-decoration:none',
                                       'data-original-title': tooltipText});
        $outputElemContainer.append($spinnerElem);
        $outputElemContainer.append($outputElem);

        $('.toolbar-button.waze-icon-place').parent().prepend($outputElemContainer);
        $outputElem.tooltip({
            placement: 'auto top',
            delay: {show: 100, hide: 100},
            html: true,
            template: '<div class="tooltip" role="tooltip" style="opacity:0.95"><div class="tooltip-arrow"></div><div class="my-tooltip-header"><b></b></div><div class="my-tooltip-body tooltip-inner" style="font-weight:600; !important"></div></div>'
        });

        getRequestsCount();
    }

    function ACHelper_prepareUI() {
        if (Waze.selectionManager.selectedItems.length <= 0)
            return;

        var selectedItem = Waze.selectionManager.selectedItems[0];

        if (typeof selectedItem.model === "undefined" || selectedItem.model.type !== "segment")
            return;

        var panelID = "WME-ACH";
        if (!document.getElementById(panelID)) {
            var panelElement = document.createElement('div');
            panelElement.id = panelID;

            var userTabs = document.getElementById('edit-panel');
            if (!userTabs)
                return;

            var navTabs = getElementsByClassName('nav-tabs', userTabs)[0];
            if (typeof navTabs !== "undefined") {
                var tabContent = getElementsByClassName('tab-content', userTabs)[0];

                if (typeof tabContent !== "undefined") {
                    newtab = document.createElement('li');
                    newtab.innerHTML = '<a href="#' + panelID + '" id="wme-ach" data-toggle="tab">ACH</a>';
                    navTabs.appendChild(newtab);

                    var html =
                        '<h4>WME Add City Helper <sup>' + GM_info.script.version + '</sup></h4>'+
                        '</br>' +
                        // block 1
                        '<fieldset id="achActiveRequestPanel" style="border: 1px solid silver; padding: 8px; border-radius: 4px;">' +
                        '<legend style="margin-bottom:0px; border-bottom-style:none;width:auto;"><h5 style="font-weight: bold;">Текущий запрос НП</h5></legend>' +
                        // author
                        '<div class="form-group">' +
                        '<label class="control-label">Автор</label>' +
                        '<div class="controls">' +
                        '<input class="form-control" autocomplete="off" maxlength="100" id="achAuthor" name="" title="Автор запроса" type="text" value="N/A" readonly="readonly" />' +
                        '</div>' +
                        '</div>' +
                        // city
                        '<div class="form-group">' +
                        '<label class="control-label">Имя нового НП</label>' +
                        '<div class="controls input-group">' +
                        '<input class="form-control" autocomplete="off" maxlength="100" id="achCity" name="" title="Запрошенное имя НП" type="text" value="N/A" readonly="readonly" />' +
                        // goto button
                        '<span class="input-group-btn">' +
                        '<button id="achJumpToRequest" class="btn btn-primary" type="button" data-original-title="" title="Перейти к сегменту" style="padding: 0 8px; border-bottom-left-radius: 0; border-top-left-radius: 0; font-size: 16px">' +
                        '<i class="fa fa-crosshairs"></i>' +
                        '</button>' +
                        '</span>' +
                        '</div>' +
                        '</div>' +
                        // permalink
                        /*
                        '<div class="form-group">' +
                        '<label class="control-label">Пермалинк</label>' +
                        '<div class="controls input-group">' +
                        '<input class="form-control" autocomplete="off" id="achPermalink" name="" title="Пермалинк" type="text" value="N/A" readonly="readonly" />' +
                        '<span class="input-group-btn">' +
                        '<button id="achJumpToRequest" class="btn btn-primary" type="button" data-original-title="" title="Перейти к сегменту" style="padding: 0 8px; border-bottom-left-radius: 0; border-top-left-radius: 0; font-size: 16px">' +
                        '<i class="fa fa-crosshairs"></i>' +
                        '</button>' +
                        '</span>' +
                        '</div>' +
                        '</div>' +
                        */
                        // status
                        '<div class="form-group">' +
                        '<label class="control-label">Статус</label>' +
                        '<div class="controls">' +
                        '<input class="form-control" autocomplete="off" maxlength="100" id="achStatus" name="" title="Статус запроса" type="text" value="N/A" readonly="readonly" />' +
                        '</div>' +
                        '</div>' +
                        '<div class="form-group">' +
                        '<label class="control-label">Действия</label>' +
                        '<div class="btn-toolbar">' +
                        // lock request
                        '<button id="achLockRequest" class="btn btn-info" type="button" title="Взять запрос в работу (залочить)" style="font-size: 16px">' +
                        '<i class="fa fa-lock"></i>' +
                        '</button>' +
                        // approve
                        '<button id="achApproveRequest" class="btn btn-success" type="button" title="Одобрить запрос" style="font-size: 16px">' +
                        '<i class="fa fa-thumbs-up"></i>' +
                        '</button>' +
                        // decline
                        '<button id="achDeclineRequest" class="btn btn-danger" type="button" title="Отказать" style="font-size: 16px">' +
                        '<i class="fa fa-thumbs-down"></i>' +
                        '</button>' +
                        // send email
                        '<button id="achSendEmail" class="btn btn-default" type="button" title="Отправить письмо" style="font-size: 16px">' +
                        '<i class="fa fa-envelope-o"></i>' +
                        '</button>' +
                        '</div>' +
                        '</div>' +
                        // end 1
                        '</fieldset>' +
                        // block 2
                        '</br>' +
                        '<fieldset id="achMinRegionPanel" style="border: 1px solid silver; padding: 8px; border-radius: 4px;">' +
                        '<legend style="margin-bottom:0px; border-bottom-style:none;width:auto;"><h5 style="font-weight: bold;">МинРегион</h5></legend>' +
                        // check name in MinRegion
                        '<div class="form-group">' +
                        '<button id="achCheckInMinRegion" class="action-button btn btn-lightning btn-positive" type="button" title="Проверить имя в МинРегионе">' +
                        '<i class="fa fa-map-o"></i>&nbsp;Проверить' +
                        '</button>' +
                        '</div>' +
                        // foundName
                        '<div class="form-group">' +
                        '<label class="control-label">Согласно МинРегиону здесь находится</label>' +
                        '<div class="controls input-group">' +
                        '<input class="form-control" autocomplete="off" id="achFoundCity" name="" title="Найденный НП" type="text" value="N/A" readonly="readonly" />' +
                        '<span class="input-group-btn">' +
                        '<button id="achApplyFoundCity" class="btn btn-primary" type="button" data-original-title="" title="Использовать это имя" style="padding: 0 8px; border-bottom-left-radius: 0; border-top-left-radius: 0; font-size: 16px">' +
                        '<i class="fa fa-paw"></i>' +
                        '</button>' +
                        '</span>' +
                        '</div>' +
                        '</div>' +
                        // suggestedName
                        '<div class="form-group">' +
                        '<label class="control-label">Имя с учетом правил именования</label>' +
                        '<div class="controls input-group">' +
                        '<input class="form-control" autocomplete="off" id="achSuggestedName" name="" title="Предложенное имя для НП" type="text" value="N/A" readonly="readonly" />' +
                        '<span class="input-group-btn">' +
                        '<button id="achApplySuggestedCity" class="btn btn-primary" type="button" data-original-title="" title="Использовать это имя" style="padding: 0 8px; border-bottom-left-radius: 0; border-top-left-radius: 0; font-size: 16px">' +
                        '<i class="fa fa-paw"></i>' +
                        '</button>' +
                        '</span>' +
                        '</div>' +
                        '</div>' +
                        // result
                        '<div class="form-group">' +
                        '<label class="control-label">Ответ анализатора</label>' +
                        '<div class="controls">' +
                        '<label style="font-weight: bold;">Статус:&nbsp;</label>' +
                        '<span id="achMRResponseStatus" style="font-weight: bold;"></span></br>' +
                        '<label style="font-weight: bold;">Комментарии:</label></br>' +
                        '<span id="achMRResponseComments"></span>' +
                        '</div>' +
                        '</div>' +
                        // end 2
                        '</fieldset>';

                    panelElement.innerHTML = html;
                    panelElement.className = "tab-pane";
                    tabContent.appendChild(panelElement);
                }
                else {
                    panelElement.id = '';
                }
            }
            else {
                panelElement.id = '';
            }

            if (panelElement.id !== '') {
                document.getElementById('achJumpToRequest').onclick = onJumpToClick;

                document.getElementById('achLockRequest').onclick = onLockRequest;
                document.getElementById('achCheckInMinRegion').onclick = onCheckMinRegion;
                document.getElementById('achApproveRequest').onclick = onApproveRequest;
                document.getElementById('achDeclineRequest').onclick = onDeclineRequest;
                document.getElementById('achSendEmail').onclick = onSendEmail;

                document.getElementById('achApplyFoundCity').onclick = function() {
                    var cityName = document.getElementById('achFoundCity').value;
                    if (cityName !== '' && cityName !== 'N/A') {
                        ChangeCity(cityName);
                    }
                    return false;
                };
                document.getElementById('achApplySuggestedCity').onclick = function() {
                    var cityName = document.getElementById('achSuggestedName').value;
                    if (cityName !== '' && cityName !== 'N/A') {
                        ChangeCity(cityName);
                    }
                    return false;
                };
            }
        }

        if (document.getElementById(panelID) !== null) {
            if (curRequest.requestedCity) {
                document.getElementById('achAuthor').value = curRequest.author;
                document.getElementById('achCity').value = curRequest.requestedCity;
                //document.getElementById('achPermalink').value = curRequest.permalink;
                document.getElementById('achJumpToRequest').disabled = false;
            }
            else {
                document.getElementById('achAuthor').value = "N/A";
                document.getElementById('achCity').value = "N/A";
                //document.getElementById('achPermalink').value = "N/A";
                document.getElementById('achJumpToRequest').disabled = true;
            }

            updateRequestStatus();

            document.getElementById('achApplyFoundCity').disabled = true;
            document.getElementById('achApplySuggestedCity').disabled = true;
        }
    }

    function setButtonClass(id, className) {
        var iButton = document.getElementById(id).firstChild;
        if (iButton.className !== className) {
            iButton.className = className;
        }
    }

    function setRequestStatus(statusText) {
        curRequest.status = statusText ? statusText : '';
        updateRequestStatus();
    }

    function updateRequestStatus() {
        var inputStatus = document.getElementById('achStatus');

        if (inputStatus) {
            var btn1 = document.getElementById('achLockRequest');
            var btn2 = document.getElementById('achApproveRequest');
            var btn3 = document.getElementById('achDeclineRequest');
            var btn4 = document.getElementById('achSendEmail');

            inputStatus.value = curRequest.status ? curRequest.status : 'N/A';

            switch (curRequest.status)
            {
                case 'active':
                    btn1.disabled = false;
                    btn2.disabled = false;
                    btn3.disabled = false;
                    btn4.disabled = true;
                    break;
                case 'locked':
                    btn1.disabled = true;
                    btn2.disabled = false;
                    btn3.disabled = false;
                    btn4.disabled = true;
                    break;
                case 'approved':
                case 'declined':
                    btn1.disabled = true;
                    btn2.disabled = true;
                    btn3.disabled = true;
                    btn4.disabled = false;
                    break;
                default:
                    btn1.disabled = true;
                    btn2.disabled = true;
                    btn3.disabled = true;
                    btn4.disabled = true;
                    break;
            }
        }
    }

    function onJumpToClick() {
        if (curRequest.permalink) {
            jumpToLink(curRequest.permalink);
        }
    }

    function onLockRequest() {
        var user = Waze.loginManager.user.userName;
        var buttonID = 'achLockRequest';
        if (curRequest.row) {
            GM_xmlhttpRequest({
                url: apiUrl + '?func=processRequest&row=' + curRequest.row + '&user=' + user + '&action=lock',
                method: 'GET',
                timeout: requestsTimeout,
                onload: function(res) {
                    setButtonClass(buttonID, 'fa fa-lock');
                    if (res.status === 200) {
                        var text = JSON.parse(res.responseText);
                        if (text.result == 'success') {
                            setRequestStatus('locked');
                            document.getElementById('achLockRequest').disabled = true;
                        }
                        else {
                            alert(text.result);
                        }
                    }
                    else {
                        alert("Error processing request. Response: " + res.responseText);
                    }
                },
                onreadystatechange: function(res) {
                    setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                },
                ontimeout: function(res) {
                    alert("Sorry, request timeout!");
                    setButtonClass(buttonID, 'fa fa-lock');
                },
                onerror: function(res) {
                    alert("Sorry, request error!");
                    setButtonClass(buttonID, 'fa fa-lock');
                }
            });
        }
    }

    function onCheckMinRegion() {
        var buttonID = 'achCheckInMinRegion';
        var tempUrl = 'http://localhost:8080/GetSuggestedCityName';
        var emptyResponse = {};

        if (curRequest.permalink) {
            var lnk = parseLink(curRequest.permalink);
            //TODO enable check if no permalink
            GM_xmlhttpRequest({
                url: tempUrl + '?lon=' + lnk.lon + '&lat=' + lnk.lat,
                method: 'GET',
                timeout: requestsTimeout,
                onload: function(res) {
                    setButtonClass(buttonID, 'fa fa-map-o');
                    if (res.status === 200) {
                        var text = JSON.parse(res.responseText);
                        //alert(res.responseText);
                        updateMinRegionInfo(text);
                    }
                    else {
                        alert("Error processing request. Response: " + res.responseText);
                        updateMinRegionInfo(emptyResponse);
                    }
                },
                onreadystatechange: function(res) {
                    setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                },
                ontimeout: function(res) {
                    alert("Sorry, request timeout!");
                    setButtonClass(buttonID, 'fa fa-map-o');
                    updateMinRegionInfo(emptyResponse);
                },
                onerror: function(res) {
                    alert("Sorry, request error!");
                    setButtonClass(buttonID, 'fa fa-map-o');
                    updateMinRegionInfo(emptyResponse);
                }
            });
        }
    }

    function onApproveRequest() {
        var user = Waze.loginManager.user.userName;
        var buttonID = 'achApproveRequest';
        if (curRequest.row) {
            var selectedItem = Waze.selectionManager.selectedItems[0].model;
            var currentCity = '';
            if (selectedItem.type === "segment") {
                var street = Waze.model.streets.objects[selectedItem.attributes.primaryStreetID];
                var city = Waze.model.cities.objects[street.cityID];
                currentCity = city.attributes.name;
            }

            curRequest.note = prompt('Присвоенное имя НП', currentCity);

            if (curRequest.note) {
                GM_xmlhttpRequest({
                    url: apiUrl + '?func=processRequest&row=' + curRequest.row + '&user=' + user + '&action=approve&note=' + curRequest.note,
                    method: 'GET',
                    timeout: requestsTimeout,
                    onload: function(res) {
                        setButtonClass(buttonID, 'fa fa-thumbs-up');
                        if (res.status === 200) {
                            var text = JSON.parse(res.responseText);
                            if (text.result == 'success') {
                                setRequestStatus('approved');
                            }
                            else {
                                alert(text.result);
                            }
                        }
                        else {
                            alert("Error processing request. Response: " + res.responseText);
                        }
                    },
                    onreadystatechange: function(res) {
                        setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                    },
                    ontimeout: function(res) {
                        alert("Sorry, request timeout!");
                        setButtonClass(buttonID, 'fa fa-thumbs-up');
                    },
                    onerror: function(res) {
                        alert("Sorry, request error!");
                        setButtonClass(buttonID, 'fa fa-thumbs-up');
                    }
                });
            }
        }
    }

    function onDeclineRequest() {
        var user = Waze.loginManager.user.userName;
        var buttonID = 'achDeclineRequest';
        if (curRequest.row) {
            curRequest.note = prompt('Причина отказа?', 'Такой НП уже существует.');

            if (curRequest.note) {
                GM_xmlhttpRequest({
                    url: apiUrl + '?func=processRequest&row=' + curRequest.row + '&user=' + user + '&action=decline&note=' + curRequest.note,
                    method: 'GET',
                    timeout: requestsTimeout,
                    onload: function(res) {
                        setButtonClass(buttonID, 'fa fa-thumbs-down');
                        if (res.status === 200) {
                            var text = JSON.parse(res.responseText);
                            if (text.result == 'success') {
                                setRequestStatus('declined');
                            }
                            else {
                                alert(text.result);
                            }
                        }
                        else {
                            alert("Error processing request. Response: " + res.responseText);
                        }
                    },
                    onreadystatechange: function(res) {
                        setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                    },
                    ontimeout: function(res) {
                        alert("Sorry, request timeout!");
                        setButtonClass(buttonID, 'fa fa-thumbs-down');
                    },
                    onerror: function(res) {
                        alert("Sorry, request error!");
                        setButtonClass(buttonID, 'fa fa-thumbs-down');
                    }
                });
            }
        }
    }

    function onSendEmail() {
        var buttonID = 'achSendEmail';
        if (curRequest.row) {
            GM_xmlhttpRequest({
                url: apiUrl + '?func=sendEmail&row=' + curRequest.row,
                method: 'GET',
                timeout: requestsTimeout,
                onload: function(res) {
                    setButtonClass(buttonID, 'fa fa-envelope-o');
                    if (res.status === 200) {
                        var text = JSON.parse(res.responseText);
                        if (text.result == 'success') {
                            //TODO ?
                            alert(text.result);
                        }
                        else {
                            alert(text.result);
                        }
                    }
                    else {
                        alert("Error processing request. Response: " + res.responseText);
                    }
                },
                onreadystatechange: function(res) {
                    setButtonClass(buttonID, 'fa fa-spinner fa-pulse');
                },
                ontimeout: function(res) {
                    alert("Sorry, request timeout!");
                    setButtonClass(buttonID, 'fa fa-envelope-o');
                },
                onerror: function(res) {
                    alert("Sorry, request error!");
                    setButtonClass(buttonID, 'fa fa-envelope-o');
                }
            });
        }
    }

    function updateMinRegionInfo(rs) {
        var disableButtons = true;
        if (rs.foundcity) {
            disableButtons = false;
            document.getElementById('achFoundCity').value = rs.foundcity;
            document.getElementById('achSuggestedName').value = rs.suggestedcity;

            document.getElementById('achMRResponseStatus').style.color = (rs.status == 'OK' ? 'green' : (rs.status.match(/error/) ? 'red' : 'yellow'));
            document.getElementById('achMRResponseStatus').innerHTML = rs.status.replace(',', '</br>');
            document.getElementById('achMRResponseComments').innerHTML = rs.comments.replace(',', '</br>');
        }
        else {
            document.getElementById('achFoundCity').value = 'N/A';
            document.getElementById('achSuggestedName').value = 'N/A';
            document.getElementById('achMRResponseStatus').innerHTML = '';
            document.getElementById('achMRResponseComments').innerHTML = '';

        }
        document.getElementById('achApplyFoundCity').disabled = disableButtons;
        document.getElementById('achApplySuggestedCity').disabled = disableButtons;
    }

    function processGetResult(rq) {
        if (rq.city) {
            curRequest.author = rq.requestor;
            curRequest.requestedCity = rq.city;
            curRequest.permalink = rq.permalink;
            curRequest.row = rq.row;

            jumpToLink(rq.permalink);
        }
        else {
            curRequest.author = '';
            curRequest.requestedCity = '';
            curRequest.permalink = '';
            curRequest.row = '';
            curRequest.status = '';
        }
    }

    function jumpToLink(permalink) {
        var lnk = parseLink(permalink);

        function mergestart() {
            Waze.model.events.unregister("mergestart", null, mergestart);
            Waze.model.events.register("mergeend", null, mergeend);
        }
        function mergeend() {
            Waze.model.events.unregister("mergeend", null, mergeend);

            if (lnk.segments) {
                // if we have multiple selection
                var segArray = lnk.segments.split(",");
                var objects = [];
                for (var i = 0; i < segArray.length; i++) {
                    objects.push(Waze.model.segments.objects[segArray[i]]);
                }
                Waze.selectionManager.select(objects);
            }
        }

        if (!(lnk.lon && lnk.lat && lnk.segments)) {
            alert("error parsing permalink: " + permalink);
            return;
        }

        Waze.model.events.register("mergestart", null, mergestart);

        Waze.selectionManager.unselectAll();
        var xy = OpenLayers.Layer.SphericalMercator.forwardMercator(parseFloat(lnk.lon), parseFloat(lnk.lat));
        if (lnk.zoom) {
            Waze.map.setCenter(xy, parseInt(lnk.zoom));
        } else {
            Waze.map.setCenter(xy);
        }
    }

    function parseLink(permalink) {
        var link = {};

        var parts = permalink.split('?');
        var attrs = parts[1].split('&');
        for (var i = 0; attrs[i]; i++) {
            var attrName = attrs[i].split('=');
            switch (attrName[0]) {
                case "lat":
                    link.lat = attrName[1];
                    break;
                case "lon":
                    link.lon = attrName[1];
                    break;
                case "zoom":
                    link.zoom = attrName[1];
                    break;
                case "segments":
                    link.segments = attrName[1];
                    break;
                default:
                    break;
            }
        }
        return link;
    }

    function updateInProgressIndicator() {
        if (isRequestActive) {
            document.getElementById('achSpinner').style.display = "inline-block";
        }
        else {
            document.getElementById('achSpinner').style.display = "none";
        }
    }

    function getCityRequest() {
        var user = Waze.loginManager.user.userName;
        isRequestActive = true;
        GM_xmlhttpRequest({
            url: apiUrl + '?func=getCityRequest&user=' + user,
            method: 'GET',
            timeout: requestsTimeout,
            onload: function(res) {
                var count = "error";
                isRequestActive = false;
                updateInProgressIndicator();
                if (res.status === 200) {
                    var text = JSON.parse(res.responseText);
                    count = text.count;
                    if (text.result == 'success') {
                        setRequestStatus(text.status);
                        processGetResult(text);
                    }
                    else {
                        alert(text.result);
                    }
                }
                else {
                    alert("Error loading city. Response: " + res.responseText);
                }
                updateRequestsCount(count);
            },
            onreadystatechange: function(res) {
                updateInProgressIndicator();
            },
            ontimeout: function(res) {
                alert("Sorry, request timeout!");
                isRequestActive = false;
                updateInProgressIndicator();
            },
            onerror: function(res) {
                alert("Sorry, request error!");
                isRequestActive = false;
                updateInProgressIndicator();
            }
        });
    }

    function updateRequestsCount(count) {
        var textColor = '';
        var bgColor = '';
        var tooltipTextColor = 'white';

        if (parseInt(count) === 0) {
            textColor = 'white';
            bgColor = 'green';
        }
        else if (parseInt(count) > 0 && parseInt(count) <= 20) {
            bgColor = 'yellow';
            tooltipTextColor = 'black';
        }
        else {
            textColor = 'white';
            bgColor = 'red';
        }

        $('#achCountContainer').css('background-color', bgColor);
        $('#achCount').css('color', textColor).html('Запросы НП: ' + count);
    }

    function getRequestsCount() {
        GM_xmlhttpRequest({
            url: apiUrl + '?func=getRequestsCount',
            method: 'GET',
            timeout: requestsTimeout,
            onload: function(res) {
                var count = "error";
                if (res.status === 200) {
                    var text = JSON.parse(res.responseText);
                    count = text.count;
                    //alert(text.count);
                    /*
                    if (text.result == "success") {
                        count = text.count;
                    }
                    */
                }
                else {
                    alert("Error loading requests count. Response: " + res.responseText);
                }
                updateRequestsCount(count);
            },
            ontimeout: function(res) {
                alert("Sorry, request timeout!");
            },
            onerror: function(res) {
                alert("Sorry, request error!");
            }
        });
    }

    function getElementsByClassName(classname, node) {
        if (!node)
            node = document.getElementsByTagName("body")[0];
        var a = [];
        var re = new RegExp('\\b' + classname + '\\b');
        var els = node.getElementsByTagName("*");
        for (var i = 0, j = els.length; i < j; i++)
            if (re.test(els[i].className)) a.push(els[i]);
        return a;
    }

    // thanks, guys, for the functions :)
    function getEditFormControlName(id) {
        var beta = (location.hostname == "editor-beta.waze.com" ? true : false);

        var controlsMap = {
            form: beta ? 'div[class="address-edit-btn"]' : 'div[class="address-edit-btn"]',
            country: beta ? 'select[name="countryID"]' : 'select[name="countryID"]',
            state: beta ? 'select[name="stateID"]' : 'select[name="stateID"]',
            cityname: beta ? 'input[name="cityName"]' : 'input[name="cityName"]',
            citynamecheck: beta ? '#emptyCity' : '#emptyCity',
            streetname: beta ? 'input[name="streetName"]' : 'input[name="streetName"]',
            streetnamecheck: beta ? '#emptyStreet' : '#emptyStreet',
            save: beta ? 'class="btn btn-primary save-button"' : 'class="btn btn-primary save-button"',
            cancel: beta ? 'class="address-edit-cancel btn btn-default cancel-button"' : 'class="address-edit-cancel btn btn-default cancel-button"',
            name: 'name'
        };

        return controlsMap[id];
    }

    function ChangeCity(cityName) {
        $(getEditFormControlName('form')).click();

        setTimeout(function() {

            var needSave = false;
            var city = $(getEditFormControlName('cityname'));
            if (city.val() == cityName) {
                alert('НП уже имеет такое имя. Отмена.');
            }
            else {
                var chkCity = $(getEditFormControlName('citynamecheck'));
                if (chkCity[0].checked) {
                    chkCity.click();
                }

                city = $(getEditFormControlName('cityname'));

                if (city.val().length === 0 ||
                    (city.val().length !== 0 &&
                     confirm('Другое имя НП уже присвоено данному сегменту. Вы уверены, что хотите изменить его?'))) {
                    city.val(cityName).change();
                    needSave = true;

                    var street = $(getEditFormControlName('streetname')).val().length;
                    if (!street) {
                        var chkStreet = $(getEditFormControlName('streetnamecheck'));
                        if (!chkStreet[0].checked) {
                            chkStreet.click();
                        }
                    }
                    // fix, when states will be available for Ukraine
                    var state = $(getEditFormControlName('state'));
                    if (state && state.val() != '1') // temp in Ukraine
                    {
                        state.val('1').change();
                    }
                    var country = $(getEditFormControlName('country'));
                    if (country.val() != '232') // Ukraine
                    {
                        country.val('232').change();
                    }
                }
            }
            $('button[' + (needSave ? getEditFormControlName('save') : getEditFormControlName('cancel')) + ']').click();
        }, 60);
    }

    setTimeout(ACHelper_bootstrap, 3000);
})();