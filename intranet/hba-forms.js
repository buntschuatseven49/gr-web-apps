jQuery(document).ready(function () {
    var apiUrl = "https://fahrplan.search.ch/api/route.json?";

    // Get CSS colors
    var textColor = $("h2").css("color");
    var getBackgroundColor = $(".AutoForm").css("background");
    var backgroundColorDisabled = getBackgroundColor.split(/[(]|[)]/);
    var backgroundColorDisabledRgba = "'rgba(" + backgroundColorDisabled[1] + ", 0.5)'";

    // Form fields Adresses
    var $fromStreet = $("div.WohnadresseStrasseNr").find("input");
    var $fromPostcode = $("div.WohnadressePLZ").find("input"); 
    var $fromTown = $("div.WohnadresseOrt").find("input");
    var $toStreet = $("div.ArbeitsadresseStrasseNr").find("input");
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

    // Message texts
    var messagesDE = {
    msgInvalidApplicationDate: "Wählen Sie bitte ein Antragsdatum, das nicht in der Vergangenheit liegt.",
    msgNoConnections: " Überprüfen Sie bitte Ihre Angaben.",
    msgSuccess: "Für Ihre Angaben wurden folgende Verbindungsdaten ermittelt.",
    msgApiError: "Ihre Anfrage kann momentan nicht ausgeführt werden, bitte versuchen Sie es zu einem späteren Zeitpunkt nochmal.",
    }
    

    // Validate application date selection in future
    var $dateCheck = $('div.Neuantragab').find('input');
    $dateCheck.change(function(){
    var dateString = $('div.Neuantragab').find('input').val();
    var dateParts = dateString.split(".");
    var dateObject = new Date(+dateParts[2], dateParts[1] - 1, +dateParts[0]);
    var dateToday = new Date();
    $($dateCheckMessage).text("")
    if (dateObject < dateToday.setHours(0, 0, 0, 0)) {  
        $($dateCheckMessage).text(messagesDE.msgInvalidApplicationDate);
    }
    });

	// Check for changes in adress fields and get connections
    $fromStreet.add($fromPostcode).add($fromTown).add($toStreet).add($toPostcode).add($toTown).on("change", function(){ // $($fromStreet, $...) // .on("change", function
        getConnections();
    });
	
    function getConnections() {
        // Check if no adress field is empty
        if ($fromStreet.val() && $fromPostcode.val() && $fromTown.val() && $toStreet.val() && $toPostcode.val() && $toTown.val()) {

        // Set date to weekday        
        function setWeekday() {
            var date = new Date();
            var _todayDay = date.getDay();
            if (_todayDay == 0) {
                date.setDate(date.getDate() + 2);
            }
            else if (_todayDay == 7) {
                date.setDate(date.getDate() + 5);
            }
            return date.toLocaleDateString();
        }
        var dateApiRequest = setWeekday();  //----------------------------

        // Call api request for street an postcode. City can lead to false connections if postcode does not fit.
        // Postcode then can be taken as streetnumber. Street is always the strongest argument. 
        // If street doesn't fit to city, the api takes any city, the street exists.
        $.ajax({
        url: apiUrl + 'from=' + $fromStreet.val() + ',' + $fromPostcode.val() + '&to=' + 
        $toStreet.val() + ',' + $toPostcode.val() +'&time=06:30' + '&date=' + dateApiRequest,
        type: "GET",

        success: function (result) {

            // Check result for error
            var connections = result.connections;
            if (typeof connections == "undefined") {
                console.log(result);
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
                //$("<span id='label-shortest-connection' style='color:" + textColor + ";position:absolute;top:25%;right:20%;font-size:0.875rem'></span>")
                .insertBefore($connectionShortest);
                
                // Set success message
                console.log(result);
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
});


