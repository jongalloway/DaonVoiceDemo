// web.js
var newrelic = require('newrelic');
var express = require("express");
var logfmt = require("logfmt");
var twilio = require('twilio');
var Firebase = require("firebase");
var Async = require('async');
var app = express();

var myRootRef = new Firebase('https://daon-voice-demo.firebaseio.com/');
var validateTwilioAuth = true;

var getCustomerByAccountID = function(accountNumber, callback) {
    var myCustomerRef = myRootRef.child('customers/'+accountNumber);
    myCustomerRef.once('value', function(snapshot){
        var customer = snapshot.val();
        callback(customer);
    })
}

var getInteractionByCallSid = function(callSid, callback) {
    var myInteractionRef = myRootRef.child('interactions/'+callSid);
    myInteractionRef.once('value', function(snapshot){
        var interaction = snapshot.val();
        callback(interaction);
    })
}

var getCustomerByCallSid = function(callSid, callback) {
	getInteractionByCallSid(callSid, function(interaction){
		if(interaction)
		{
			accountNumber = interaction.account_number;
			getCustomerByAccountID(accountNumber, function(customer){
				callback(customer);
			}
		} else {
			callback(null);
		}
	});
}

var enrollVoice = function(callSid, voiceUrl, callback) {
	callback(true);
}

var authenticateVoice = function(callSid, voiceUrl, callback) {
	callback(true);
}

app.use(logfmt.requestLogger());

app.use(express.urlencoded());

app.get('/', function(req, res) {
  res.send('Daon Voice Demo');
});


app.post('/daonvoice/greet', twilio.webhook({
	validate:validateTwilioAuth
}), function(req, res) {
	var respTwiml = new twilio.TwimlResponse();
	var baseURL = req.protocol + "://" + req.get('host');

	respTwiml.say('Welcome to dayon Social Services.', { voice:'woman', language:'en-gb'});
	
	respTwiml.gather({
        action:baseURL + '/daonvoice/isregistered',
        finishOnKey:'#',
        numDigits:'8',
        timeout:'10'
    }, function() {
        this.say('Please enter your eight digit account number and then press hash.', {	voice:'woman', language:'en-gb'} );
    });

    respTwiml.say('We did not receive any input. Goodbye!', {voice:'woman', language:'en-gb'});

    res.send(respTwiml);
});


app.post('/daonvoice/isregistered', twilio.webhook({
	validate:validateTwilioAuth
}), function(req, res) {
	var baseURL = req.protocol + "://" + req.get('host');
	var respTwiml = new twilio.TwimlResponse();
	
	//Get Number
	var accountNumber = req.param("Digits");
	var callSid = req.param("CallSid");
	console.log("Got Account Number: " + accountNumber + " from call: " + callSid);
	if (accountNumber){
		//Retrieve record and handle error
		getCustomerByAccountID(accountNumber, function(customer){
			if (customer) {
			 	if (customer.registered == true)
				{
					respTwiml.gather({
				        action:baseURL + '/daonvoice/verify',
				        finishOnKey:'#',
				        numDigits:'4',
				        timeout:'10'
				    }, function() {
				        this.say('Hello ' + customer.name.first + ' ' + customer.name.last + ', please enter your four digit PIN and then press hash.', {	voice:'woman', language:'en-gb'} );
				    });
				    var listRef = myRootRef.child('interactions/');
					listRef.child(callSid).set({account_number: accountNumber, call_type: 'verification'});
				} else {
					respTwiml.gather({
				        action:baseURL + '/daonvoice/register',
				        finishOnKey:'#',
				        numDigits:'4',
				        timeout:'10'
				    }, function() {
				        this.say('Welcome ' + customer.name.first + ' ' + customer.name.last + '.  You are a new user so we must validate your details. Please enter the four digits of your year of birth and then press hash.', {	voice:'woman', language:'en-gb'} );
				    });
				    var listRef = myRootRef.child('interactions/');
					listRef.child(callSid).set({account_number: accountNumber, call_type: 'registration'});
				}
				res.send(respTwiml);
			} else {
				respTwiml.say('The registration number was not valid!.', { voice:'woman', language:'en-gb'});
				//send back to greet
				respTwiml.redirect(baseURL + '/daonvoice/greet');
				res.send(respTwiml);
			}
		});
	} else {
		respTwiml.say('The registration number was not received!.', { voice:'woman', language:'en-gb'});
		//send back to greet
		respTwiml.redirect(baseURL + '/daonvoice/greet');
    	res.send(respTwiml);
	}
});


app.post('/daonvoice/verify', twilio.webhook({
	validate:validateTwilioAuth
}), function(req, res) {
	var baseURL = req.protocol + "://" + req.get('host');
	var respTwiml = new twilio.TwimlResponse();
	
	var customerPin = req.param("Digits");
	var callSid = req.param("CallSid");
	console.log("Got customer pin: " + customerPin + " from call: " + callSid);
	if (customerPin){
		//Retrieve record and handle error
		getCustomerByCallSid(callSid, function(customer){
			if (customer) {
				//compare year of birth to digits
				//get pin and forwared to register2 to validate pin
			 	if (customer.pin == customerPin)
				{
					respTwiml.record({
				        action:baseURL + '/daonvoice/verify2',
				        finishOnKey:'#',
				        playBeeb:'true',
				        maxLength:'120',
				        timeout:'20',
				        transcribeCallback:baseURL + '/daonvoice/transcribe'
				    }, function() {
				        this.say('Please say the last four digits of your registered phone number after the beep.', {	voice:'woman', language:'en-gb'} );
				    });
				    respTwiml.say('We could not hear the last four digits of your phone number. Please start again.', { voice:'woman', language:'en-gb'});
				} else {
					respTwiml.say('The customer pin was not correct!', { voice:'woman', language:'en-gb'});
					//send back to greet
					respTwiml.redirect(baseURL + '/daonvoice/greet');
	    			res.send(respTwiml);
				}
				res.send(respTwiml);
			} else {
				respTwiml.say('There was an application error!', { voice:'woman', language:'en-gb'});
				//send back to greet
				respTwiml.redirect(baseURL + '/daonvoice/greet');
	    		res.send(respTwiml);
			}
		});
	} else {
		respTwiml.say('The customer pin was not received!', { voice:'woman', language:'en-gb'});
		//send back to greet
		respTwiml.redirect(baseURL + '/daonvoice/greet');
	    res.send(respTwiml);
	}
});

app.post('/daonvoice/verify2', twilio.webhook({
	validate:validateTwilioAuth
}), function(req, res) {
	var baseURL = req.protocol + "://" + req.get('host');
	var respTwiml = new twilio.TwimlResponse();

	var callSid = req.param("CallSid");
	var voiceUrl = req.param("RecordingUrl");
	var recordingDuration = req.param("RecordingDuration")
	if (recordingDuration > 0){
		//Retrieve record and handle error
		authenticateVoice(callSid, voiceUrl, function(isAuthenticated)
		{
		 	if (isAuthenticated)
			{
				//now check the transcription
				var wait = 0;
				var timeout = 10;
				var got_transcription = false;
				var transcription_result;

				async.until(
				    function () { return ((wait < timeout)||(got_transcription)); },
				    function (callback) {
				    		getInteractionByCallSid(callSid, function(interaction){
							if(interaction)
							{
								transcription_result = interaction.transcription_result;
								got_transcription = true;
							} else {
								callback(null);
							}
						});
				        count++;
				        setTimeout(callback, 1000);
				    },
				    function (err) {
				    	if(got_transcription)
				    	{
				    		if (transcription_result)
				    		{
				    			var listRef = myRootRef.child('interactions/');
								listRef.child(callSid).set({overall_result: true});
								var custListRef = myRootRef.child('customers/');
								custListRef.child(interaction.account_number).set({last_verified: Date.now()});
								//TODO: set verified date on customer
				    			respTwiml.say('Your verification was successful your payment will be processed within the next 24 hours. Goodbye.', { voice:'woman', language:'en-gb'});
				    			res.send(respTwiml);
				    		} else {
				    			console.error("Trancription did not match!");
				    			var listRef = myRootRef.child('interactions/');
								listRef.child(callSid).set({overall_result: false});
				    			respTwiml.say('Your voice sample could not be authenticated. Please try again.', { voice:'woman', language:'en-gb'});
								//send back to greet
								respTwiml.redirect(baseURL + '/daonvoice/greet');
				    			res.send(respTwiml);
				    		}
				    	} else {
				    		console.error("Transcription timed out.");
				    		respTwiml.say('Your voice sample could not be authenticated. Please try again.', { voice:'woman', language:'en-gb'});
							//send back to greet
							respTwiml.redirect(baseURL + '/daonvoice/greet');
			    			res.send(respTwiml);
				    	}
				    }
				 );
			} else {
				respTwiml.say('Your voice sample could not be authenticated. Please try again.', { voice:'woman', language:'en-gb'});
				//send back to greet
				respTwiml.redirect(baseURL + '/daonvoice/greet');
    			res.send(respTwiml);
			}
		});
	} else {
		respTwiml.say('Your voice sample could not be authenticated. Please try again.', { voice:'woman', language:'en-gb'});
		//send back to greet
		respTwiml.redirect(baseURL + '/daonvoice/greet');
	    res.send(respTwiml);
	}
});

app.post('/daonvoice/transcribe', twilio.webhook({
	validate:validateTwilioAuth
}), function(req, res) {
	var baseURL = req.protocol + "://" + req.get('host');
	var callSid = req.param("CallSid");
	var transciptionText = req.param("transcriptionText");
	console.log("Got transcribe callback with value '" + transciptionText + "' from call: " + callSid);
	getCustomerByCallSid(callSid, function(customer){
		if (customer) {
			//compare year of birth to digits
			//get pin and forwared to register2 to validate pin
			var lastPhoneDigits = customer.phone.substring(customer.phone.length-4,customer.phone.length);
		 	if (lastPhoneDigits == transciptionText)
			{
				console.log('The last four digits of the phone number entered were correct!');
				//persist result
				var listRef = myRootRef.child('interactions/');
				listRef.child(callSid).set({transcription_result: true, transcription_text: transciptionText});
			} else {
				console.log('The last four digits of the phone number entered were not correct!');
				//persist result
				var listRef = myRootRef.child('interactions/');
				listRef.child(callSid).set({transcription_result: false, transcription_text: transciptionText});
			}
			res.send(respTwiml);
		} else {
			console.error('There was an application error in the transcribe callback! - Could not load customer');
		}
	});
});

app.post('/daonvoice/register', twilio.webhook({
	validate:validateTwilioAuth
}), function(req, res) {
	var baseURL = req.protocol + "://" + req.get('host');
	var respTwiml = new twilio.TwimlResponse();
	
	var yearOfBirth = req.param("Digits");
	var callSid = req.param("CallSid");
	console.log("Got Year Of Birth: " + yearOfBirth + " from call: " + callSid);
	if (yearOfBirth){
		//Retrieve record and handle error
		getCustomerByCallSid(callSid, function(customer){
			if (customer) {
				//compare year of birth to digits
				//get pin and forwared to register2 to validate pin
			 	if (customer.dob.year == yearOfBirth)
				{
					respTwiml.gather({
				        action:baseURL + '/daonvoice/register2',
				        finishOnKey:'#',
				        numDigits:'4',
				        timeout:'10'
				    }, function() {
				        this.say('Please enter your four digit PIN and then press hash.', {	voice:'woman', language:'en-gb'} );
				    });
				} else {
					respTwiml.say('The year of birth entered was not correct!', { voice:'woman', language:'en-gb'});
					//send back to greet
					respTwiml.redirect(baseURL + '/daonvoice/greet');
	    			res.send(respTwiml);
				}
				res.send(respTwiml);
			} else {
				respTwiml.say('There was an application error!', { voice:'woman', language:'en-gb'});
				//send back to greet
				respTwiml.redirect(baseURL + '/daonvoice/greet');
	    		res.send(respTwiml);
			}
		});
	} else {
		respTwiml.say('The year of birth was not received!', { voice:'woman', language:'en-gb'});
		//send back to greet
		respTwiml.redirect(baseURL + '/daonvoice/greet');
	    res.send(respTwiml);
	}
});

app.post('/daonvoice/register2', twilio.webhook({
	validate:validateTwilioAuth
}), function(req, res) {
	var baseURL = req.protocol + "://" + req.get('host');
	var respTwiml = new twilio.TwimlResponse();
	
	var customerPin = req.param("Digits");
	var callSid = req.param("CallSid");
	console.log("Got customer pin: " + customerPin + " from call: " + callSid);
	if (customerPin){
		//Retrieve record and handle error
		getCustomerByCallSid(callSid, function(customer){
			if (customer) {
				//compare year of birth to digits
				//get pin and forwared to register2 to validate pin
			 	if (customer.pin == customerPin)
				{
					respTwiml.record({
				        action:baseURL + '/daonvoice/register3',
				        finishOnKey:'#',
				        playBeeb:'true',
				        maxLength:'120',
				        timeout:'20',
				        transcribeCallback:baseURL + '/daonvoice/transcribe'
				    }, function() {
				        this.say('Please say the last four digits of your registered phone number after the beep.', {	voice:'woman', language:'en-gb'} );
				    });
				    respTwiml.say('We could not hear the last four digits of your phone number. Please start again.', { voice:'woman', language:'en-gb'});
				} else {
					respTwiml.say('The customer pin was not correct!', { voice:'woman', language:'en-gb'});
					//send back to greet
					respTwiml.redirect(baseURL + '/daonvoice/greet');
	    			res.send(respTwiml);
				}
				res.send(respTwiml);
			} else {
				respTwiml.say('There was an application error!', { voice:'woman', language:'en-gb'});
				//send back to greet
				respTwiml.redirect(baseURL + '/daonvoice/greet');
	    		res.send(respTwiml);
			}
		});
	} else {
		respTwiml.say('The customer pin was not received!', { voice:'woman', language:'en-gb'});
		//send back to greet
		respTwiml.redirect(baseURL + '/daonvoice/greet');
	    res.send(respTwiml);
	}
});

app.post('/daonvoice/register3', twilio.webhook({
	validate:validateTwilioAuth
}), function(req, res) {
	var baseURL = req.protocol + "://" + req.get('host');
	var respTwiml = new twilio.TwimlResponse();

	var callSid = req.param("CallSid");
	var voiceUrl = req.param("RecordingUrl");
	var recordingDuration = req.param("RecordingDuration")
	if (recordingDuration > 0){
		//Check the transcription
		var wait = 0;
		var timeout = 10;
		var got_transcription = false;
		var transcription_result;

		async.until(
		    function () { return ((wait < timeout)||(got_transcription)); },
		    function (callback) {
		    	getInteractionByCallSid(callSid, function(interaction){
					if(interaction)
					{
						transcription_result = interaction.transcription_result;
						got_transcription = true;
					} else {
						callback(null);
					}
				});
		        count++;
		        setTimeout(callback, 1000);
		    },
		    function (err) {
		    	if(got_transcription)
		    	{
		    		if (transcription_result)
		    		{
		    			enrollVoice(callSid, voiceUrl, function(isEnrolled)
						{
						 	if (isEnrolled)
							{
								getInteractionByCallSid(callSid, function(interaction){
									if(interaction)
									{
										var listRef = myRootRef.child('customers/');
										listRef.child(accountNumber).set({registered: true});
									    respTwiml.say('Your registraton was successful. Please call again to verify, goodbye.', { voice:'woman', language:'en-gb'});
									    res.send(respTwiml);
									} else {
										console.error("Could not find registraton using callSID: " + callSid);
										respTwiml.say('Your voice sample could not be enrolled. Please try again.', { voice:'woman', language:'en-gb'});
										//send back to greet
										respTwiml.redirect(baseURL + '/daonvoice/greet');
						    			res.send(respTwiml);
									}
								});
							} else {
								respTwiml.say('Your voice sample could not be enrolled. Please try again.', { voice:'woman', language:'en-gb'});
								//send back to greet
								respTwiml.redirect(baseURL + '/daonvoice/greet');
				    			res.send(respTwiml);
							}
						});
		    		} else {
		    			console.error("Transcription text not correct.");
    					respTwiml.say('Your voice sample could not be enrolled. Please try again.', { voice:'woman', language:'en-gb'});
						//send back to greet
						respTwiml.redirect(baseURL + '/daonvoice/greet');
		    			res.send(respTwiml);
		    		}
		    	} else {
		    		console.error("Transcription was not received.");
					respTwiml.say('Your voice sample could not be enrolled. Please try again.', { voice:'woman', language:'en-gb'});
					//send back to greet
					respTwiml.redirect(baseURL + '/daonvoice/greet');
	    			res.send(respTwiml);
		    	}
		    }
		);
	} else {
		respTwiml.say('Your voice sample could not be enrolled. Please try again.', { voice:'woman', language:'en-gb'});
		//send back to greet
		respTwiml.redirect(baseURL + '/daonvoice/greet');
	    res.send(respTwiml);
	}
});

var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);
});
