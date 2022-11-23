jQuery(document).ready(function () {
    var apiUrl = "https://fahrplan.search.ch/api/route.json?";

    // Get CSS colors
    var textColor = $("h2").css("color");
    var getBackgroundColor = $(".AutoForm").css("background");
    var backgroundColorDisabled = getBackgroundColor.split(/[(]|[)]/);
    var backgroundColorDisabledRgba = "'rgba(" + backgroundColorDisabled[1] + ", 0.5)'";
    var backgroundColorDisabledRgbaImp = "'rgba(" + backgroundColorDisabled[1] + ", 0.5)!important'";

    // Form fields Adresses
    var $fromStreet = $("div.WohnadresseStrasse").find("input");
    var $fromStreetNr = $("div.WohnadresseNr").find("input");
    var $fromPostcode = $("div.WohnadressePLZ").find("input"); 
    var $fromTown = $("div.WohnadresseOrt").find("input");
    var $toStreet = $("div.ArbeitsadresseStrasse").find("input");
    var $toStreetNr = $("div.ArbeitsadresseNr").find("input");
    var $toPostcode = $("div.ArbeitsadressePLZ").find("input");
    var $toTown = $("div.ArbeitsadresseOrt").find("input");

    // Form fields times
    var $connectionShortestDiv = $("div.KürzesteReisedauermitÖV");
    var $connectionAverageDiv = $("div.DurchschnittlicheReisedauermitÖV");

    // Form fields times input
    var $connectionShortest = $($connectionShortestDiv).find("input");
    var $connectionAverage = $($connectionAverageDiv).find("input");
    
    // Style form fields disabled input
    $connectionShortest.add($connectionAverage).css({"background":backgroundColorDisabledRgba,"text-align":"end","color":textColor});

    // Form fields hidden
    var $stationDeparture = $("div.Abfahrthaltestelle").find("input");
    var $stationArrival = $("div.Zielhaltestelle").find("input");
    var $walkDuration = $("div.DauerFusswegzuAbfahrthaltestelle").find("input");

    // Disable form fields times
    $connectionShortestDiv.add($connectionAverageDiv).css({"pointer-events":"none"});
    $connectionShortest.add($connectionAverage).prop("readonly", true);

    // Hide form fields hidden
    $stationDeparture.parent().hide();
    $stationArrival.parent().hide();
    $walkDuration.parent().hide();

    // Generate info message DIV
    $("<div id='search-api-message' style='font-size:0.875rem;padding:0.5rem 0'> </div>").insertBefore("div.KürzesteReisedauermitÖV");
    var $apiMessage = $("#search-api-message");
    $("<div id='date-invalid-message' style='color:red;font-size:0.875rem;margin-bottom:0.5rem'> </div>").insertAfter("div.Neuantragab");
    var $dateCheckMessage = $("#date-invalid-message");
    $("<div id='town-invalid-resident' style='color:red;font-size:0.875rem;margin-bottom:0.5rem'> </div>").insertAfter("div.WohnadresseOrt");
    var $adressValResidentTownMessage = $("#town-invalid-resident");
    $("<div id='town-invalid-work' style='color:red;font-size:0.875rem;margin-bottom:0.5rem'> </div>").insertAfter("div.ArbeitsadresseOrt");
    var $adressValWorkTownMessage = $("#town-invalid-work");

    // Message texts
    var messagesDE = {
    msgInvalidApplicationDate: "Wählen Sie bitte ein Antragsdatum, das nicht in der Vergangenheit liegt.",
    msgAdressValTown: "PLZ und Ort stimmen nicht überein.",
    msgNoConnections: " Überprüfen Sie bitte Ihre Angaben.",
    msgSuccess: "Für Ihre Angaben wurden folgende Verbindungsdaten ermittelt.",
    msgApiError: "Ihre Anfrage kann momentan nicht ausgeführt werden, bitte versuchen Sie es zu einem späteren Zeitpunkt nochmal.",
    }

    // Validate application date selection in future
    $('.k-select').css({"background":textColor});
    $('.k-calendar').find('.k-header').css({"background-color":backgroundColorDisabledRgbaImp});
    var $dateCheckApplication = $('div.Neuantragab').find('input');
    var $dateCheckMutation = $('div.Kündigung,Mutationper').find('input');

    $dateCheckApplication.add($dateCheckMutation).on("change", function(){
    var dateString = $(this).val();
    var dateParts = dateString.split(".");
    var dateObject = new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0]);
    var dateToday = new Date();
    $($dateCheckMessage).text("")
        if (dateObject < dateToday.setHours(0, 0, 0, 0)) {  
            $($dateCheckMessage).text(messagesDE.msgInvalidApplicationDate);
        }
    });

    // Validate address for connection request
    var addressValidation = false;



    ////////////////////////// Address Autocomplete ////////////////////////////

    // Generate container for address autocomplete and include street and streetnr.
    $("<div id='address-container-resident' style='display:flex'></div>").insertAfter('#ctl00_SPWebPartManager1_g_5acecf18_a094_4fa7_b629_3eb48d4d5f41_AutoForm_Nachname');
    $($fromStreet.parent()).detach().appendTo("#address-container-resident");
    $($fromStreetNr.parent()).detach().appendTo("#address-container-resident").addClass('Required');
    $($fromStreet.parent()).css({"width":"80%"});
    $("<div id='address-container-work' style='display:flex'></div>").insertAfter('#ctl00_SPWebPartManager1_g_5acecf18_a094_4fa7_b629_3eb48d4d5f41_AutoForm_Fahrzeug_x002d_Kennzeichen_x00200');
    $($toStreet.parent()).detach().appendTo("#address-container-work");
    $($toStreetNr.parent()).detach().appendTo("#address-container-work").addClass('Required');
    $($toStreet.parent()).css({"width":"80%"});

    // Remove dropdown on click on site
    $fromStreet.add($toStreet).focusout(function() {
        setTimeout(function(){
            $('#address-dropdown').remove();
        }, 500);
    })

    // Differ resident and workaddress for field selection in addressAutoComplete
    $fromStreet.add($toStreet).on('input', function(){
        var section;
        if ($(this).parent().prop('class').includes('Wohn')) {
            section = "Wohn";
        } else if ($(this).parent().prop('class').includes('Arbeits')) {
            section = "Arbeits";
        }
        if ($(this).val().length > 4) {
            addressAutoComplete(this, $(this).val(), section);
        }
    })

    // API request for AutoComplete, generate list and fill values to address fields on click
    function addressAutoComplete(_$element, _value, _section) {
        var _valueUmlauts = _value.replace(/\u00dc/g, "Ue").replace(/\u00fc/g, "ue").replace(/\u00c4/g, "Ae").replace(/\u00e4/g, "ae").replace(/\u00d6/g, "Oe").replace(/\u00f6/g, "oe");
        var dataAdressCheck = {    
            "request": {
                "ONRP": 0,
                "ZipCode": "",
                "ZipAddition": "",
                "TownName": "",
                "STRID": 0,
                "StreetName": _valueUmlauts,
                "HouseKey": 0,
                "HouseNo": "",
                "HouseNoAddition": ""
            },
            "zipOrderMode":0,
            "zipFilterMode":0
        };
        $.ajax({
            url: "https://02ds7tjzm7.execute-api.eu-west-1.amazonaws.com/Test?method=autocomplete4",
            type: "POST",  
            data: JSON.stringify(dataAdressCheck),
            contentType: "application/json",
            success: function (response) {
                $('#address-dropdown').remove();
                $(`<div id='address-dropdown' style='overflow:auto;max-height:16rem;position:absolute;z-index:5;width:100%;color:${textColor};background:white;box-shadow:1px 1px 3px 1px rgba(0,0,0,0.45);font-size:0.875rem;padding:0.5rem'></div>`).insertAfter($(_$element)) //parent?
                var addressDropdown = $(_$element).parent().find('#address-dropdown');
                let responseAdr = response.QueryAutoComplete4Result.AutoCompleteResult;
                for (let i = 0; i < 40 && i < responseAdr.length; i++) {
                    $(addressDropdown).append(`<div class='address-option' data-street='${responseAdr[i].StreetName}' data-zipcode='${responseAdr[i].ZipCode}' data-town='${responseAdr[i].TownName}' style='cursor:pointer'>` 
                    + responseAdr[i].StreetName + ", " + responseAdr[i].ZipCode + " " + responseAdr[i].TownName + "</div>")
                }
                $(addressDropdown).find('div.address-option').on('click', function(){
                    $('.' + _section + 'adresseStrasse').find('input').val();
                    $('.' + _section + 'adressePLZ').find('input').val();
                    $('.' + _section + 'adresseOrt').find('input').val();
                    $('.' + _section + 'adresseStrasse').addClass('is-filled').find('input').val($(this).attr("data-street"))
                    $('.' + _section + 'adressePLZ').addClass('is-filled').find('input').val($(this).attr("data-zipcode"))
                    $('.' + _section + 'adresseOrt').addClass('is-filled').find('input').val($(this).attr("data-town"))
                    $('.' + _section + 'adresseNr').find('input').focus();
                })
            },
            error: function (xhr, status) {
                console.log("error");
            }
            });
        }


    ////////////////////////////////// Address check ////////////////////////////////

    // Check for changes in address fields and all addresscheck if not empty
    $fromStreet.add($fromStreetNr).add($fromPostcode).add($fromTown).on("change", function(){
        if ($fromStreet.val() && $fromPostcode.val() && $fromTown.val()) {
            addressCheckResident();
        }
    });

    $toStreet.add($toStreetNr).add($toPostcode).add($toTown).on("change", function(){
        if ($toStreet.val() && $toPostcode.val() && $toTown.val()) {
            addressCheckWork();
            }
    });

    // Resident address
    function addressCheckResident() {
        // Set delay to make sure data from dropdown click is filled in
        setTimeout( function(){
        $.ajax({
            url: "https://02ds7tjzm7.execute-api.eu-west-1.amazonaws.com/Test"   ,
            type: "GET",    
            data: {    
                "streetname": $($fromStreet).val(),
                "houseNo": $($fromStreetNr).val(),
                "zipcode": $($fromPostcode).val(),
                "method": "buildingverification2"
            },
            contentType: "application/json",
            // Check result, display various error messages or set adressValidation to true (enables connection request)
            success: function (response) {
                $($adressValResidentTownMessage).text("");
                var respondList = response.QueryBuildingVerification2Result.BuildingVerificationData;
                
                if (respondList.TownName !== $($fromTown).val()) {
                    if (respondList.TownName === "") {
                        $($adressValResidentTownMessage).text("Die Strasse " + $($fromStreet).val() + " " + $($fromStreetNr).val() + " konnte in " 
                        + respondList.ZipCode + " " + $($fromTown).val() + " nicht gefunden werden. Bitte prüfen Sie Ihre Angaben.");
                    } else {
                    $($adressValResidentTownMessage).text(messagesDE.msgAdressValTown);
                    }
                    addressValidation = false;
                } else if ($(respondList.HouseKey).length === 0 && $($fromStreetNr).val() === "") {
                    $($adressValResidentTownMessage).text("Fehlende Hausnummer - für " + $($fromStreet).val() + " in "
                    + respondList.ZipCode + " " + $($fromTown).val() + " ist die Angabe einer Hausnummer erforderlich.");
                    addressValidation = false;
                } else if ($(respondList.HouseKey).length === 0) {
                    $($adressValResidentTownMessage).text("Die Hausnummer " + $($fromStreetNr).val() + " an " + $($fromStreet).val() + " konnte in "
                    + respondList.ZipCode + " " + $($fromTown).val() + " nicht gefunden werden. Bitte prüfen Sie Ihre Angaben.");
                    addressValidation = false;
                } else {
                    addressValidation = true;
                }                
            },
            error: function (xhr, status) {
                console.log("error");
                addressValidation = false;
            }
          });
        }, 500)
    }

    // Work address
    function addressCheckWork() {
        // Set delay to make sure data from dropdown click is filled in
          setTimeout( function(){
          $.ajax({
              url: "https://02ds7tjzm7.execute-api.eu-west-1.amazonaws.com/Test"   ,
              type: "GET",    
              data: {    
                  "streetname": $($toStreet).val(),
                  "houseNo": $($toStreetNr).val(),
                  "zipcode": $($toPostcode).val(),
                  "method": "buildingverification2"
              },
              contentType: "application/json",
              // Check result, display various error messages or set adressValidation to true (enables connection request)
              success: function (response) {
                  $($adressValWorkTownMessage).text("");
                  var respondList = response.QueryBuildingVerification2Result.BuildingVerificationData;
                  if (respondList.TownName !== $($toTown).val()) {
                    if (respondList.TownName === "") {
                        $($adressValWorkTownMessage).text("Die Strasse " + $($toStreet).val() + " " + $($toStreetNr).val() + " konnte in " 
                    + respondList.ZipCode + " " + $($toTown).val() + " nicht gefunden werden. Bitte prüfen Sie Ihre Angaben");
                    } else {
                      $($adressValWorkTownMessage).text(messagesDE.msgAdressValTown);
                    }
                    addressValidation = false;
                  } else if ($(respondList.HouseKey).length === 0 && $($toStreetNr).val() === "") {
                    $($adressValWorkTownMessage).text("Fehlende Hausnummer - für " + $($toStreet).val() + " in "
                    + respondList.ZipCode + " " + $($toTown).val() + " ist die Angabe einer Hausnummer erforderlich.");
                    addressValidation = false;
                } else if ($(respondList.HouseKey).length === 0) {
                    $($adressValWorkTownMessage).text("Die Hausnummer " + $($toStreetNr).val() + " an " + $($toStreet).val() + " konnte in " 
                    + respondList.ZipCode + " " + $($toTown).val() + " nicht gefunden werden. Bitte prüfen Sie Ihre Angaben");
                    addressValidation = false;
                } else {
                    addressValidation = true;
                }
              },
              error: function (xhr, status) {
                  console.log("error");
                  addressValidation = false;
              }
            });
        }, 500)
    }

    // Check for changes in adress fields and get connections
    $fromStreet.add($fromStreetNr).add($fromPostcode).add($fromTown).add($toStreet).add($toStreetNr).add($toPostcode).add($toTown).on("change", function(){
        // Clear results in form fields from previous request
        $connectionShortest.val("");
        $connectionAverage.val("");
        $stationDeparture.val("");
        $stationArrival.val("");
        $walkDuration.val("");
        $apiMessage.text("");
        $("#label-shortest-connection").text("");
        // Check if no adress field is empty
        if ($fromStreet.val() && $fromPostcode.val() && $fromTown.val() && $toStreet.val() && $toPostcode.val() && $toTown.val()) {
            // Check for valid address and call getConnections with delay to make sure data is updated
            setTimeout( function(){
                if (addressValidation == true) {
                getConnections();
                }
            }, 1000);
        }
    });


    //////////////////////////////////// Get connections ///////////////////////////////////////////
    function getConnections() {
        // Set date to wednesday        
        function setWeekday() {
            var date = new Date();
            var _todayDay = date.getDay();
            if (_todayDay == 0) {
                date.setDate(date.getDate() + 3);
            }
            if (_todayDay == 1) {
                date.setDate(date.getDate() + 2);
            }
            if (_todayDay == 2) {
                date.setDate(date.getDate() + 1);
            }
            if (_todayDay == 4) {
                date.setDate(date.getDate() + 6);
            }
            if (_todayDay == 5) {
                date.setDate(date.getDate() + 5);
            }
            else if (_todayDay == 6) {
                date.setDate(date.getDate() + 4);
            }
            return date.toLocaleDateString();
        }
        var dateApiRequest = setWeekday(); 

        // Call api request for street an postcode. City can lead to false connections if postcode does not fit.
        // Postcode then can be taken as streetnumber. Street is always the strongest argument. 
        // If street doesn't fit to city, the api takes any city, the street exists.
        $.ajax({
        url: apiUrl + 'from=' + $fromStreet.val() + ' ' + $fromStreetNr.val() + ',' + $fromPostcode.val() + '&to=' + 
        $toStreet.val() + ' ' + $toStreetNr.val() + ',' + $toPostcode.val() +'&time=06:30' + '&date=' + dateApiRequest,
        type: "GET",

        success: function (result) {
            // Check result for error
            var connections = result.connections;
            if (typeof connections == "undefined") {
                // Set error message
                var errorMessage;
                var apiErrorMessage = result.messages;
                if (apiErrorMessage == "undefined") {
                    errorMessage = "";
                } else {
                    errorMessage = apiErrorMessage[0];
                }
                $apiMessage.text(errorMessage + messagesDE.msgNoConnections).css({"color":"red"});

                // Clear results in form fields from previous request
                $connectionShortest.val("");
                $connectionAverage.val("");
                $stationDeparture.val("");
                $stationArrival.val("");
                $walkDuration.val("");
                $("#label-shortest-connection").text("");
                
            } else {
                // Set departure station to fastest direction
                $(`<span id='label-shortest-connection' style='color: ${textColor} ;position:absolute;top:25%;right:20%;font-size:0.875rem'></span>`)
                .insertBefore($connectionShortest);
                
                // Set success message
                $apiMessage.text(messagesDE.msgSuccess).css({"color":textColor});
            
                // Set variables for data
                var shortestConnectionTotal = result.min_duration;
                var walkToFirstStation = 0;
                var dataStationDeparture;
                var dataStationArrival;
                var connectionCounter = 0;
                var connectionsTotalDuration = 0;

                // Get shortest direction and substract walk to first station. Get departure station from second station if first type is walk.
                $(result.connections).each(function(){
                    if (this.duration == shortestConnectionTotal) {
                        if(this.legs[0].type === "walk") {
                        walkToFirstStation = this.legs[0].runningtime;
                        dataStationDeparture = this.legs[1].name;
                        }
                        else {
                        dataStationDeparture = this.legs[0].name;
                        }
                        var lastLeg = this.legs.length - 1;
                        dataStationArrival = this.legs[lastLeg].name;
                    }
                    // Add duration of each connection to total for average connection. Count connections because api sometimes returns more connections.
                    connectionsTotalDuration = connectionsTotalDuration + this.duration;
                    connectionCounter++;
                });

                // Set time format to h:min
                var shortestCalc = (shortestConnectionTotal - walkToFirstStation) / 60 / 60;
                var averageCalc = (connectionsTotalDuration / connectionCounter - walkToFirstStation) / 60 / 60;
                var walkCalc = walkToFirstStation / 60;
                var shortestConnectionWithoutWalk = Math.floor(shortestCalc) + " h " + Math.round((60 * (shortestCalc - Math.floor(shortestCalc)))) + " min";
                var connectionAverageFormatted = Math.floor(averageCalc) + " h " + Math.round((60 * (averageCalc - Math.floor(averageCalc)))) + " min";
                
                // Display departure station in form
                $("#label-shortest-connection").text(`ab ${dataStationDeparture}`);

                // Add times to form fields
                $connectionShortest.val(shortestConnectionWithoutWalk);
                $connectionAverage.val(connectionAverageFormatted);

                // Add values to hidden fields
                $stationDeparture.val(dataStationDeparture);
                $stationArrival.val(dataStationArrival);
                $walkDuration.val(walkCalc + " min");
            }
        },

        // Message if api request fails
        error: function (error) {
            $apiMessage.text(messagesDE.msgApiError);
            console.log(error);
        }
        });
    }
    }
);


