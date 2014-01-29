// web.js
var newrelic = require('newrelic');
var express = require("express");
var logfmt = require("logfmt");
var twilio = require('twilio');
var Firebase = require("firebase");
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
				        this.say('Please enter your four digit PIN and then press hash.', {	voice:'woman', language:'en-gb'} );
				    });
				    var listRef = myRootRef.child('verifications/');
					listRef.child(callSid).set({account_number: accountNumber});
				} else {
					respTwiml.gather({
				        action:baseURL + '/daonvoice/register',
				        finishOnKey:'#',
				        numDigits:'4',
				        timeout:'10'
				    }, function() {
				        this.say('Welcome ' + customer.name.first + ' ' + customer.name.last + '.  You are a new user so we must validate your details. Please enter the four digits of your year of birth and then press hash.', {	voice:'woman', language:'en-gb'} );
				    });
				    var listRef = myRootRef.child('registrations/');
					listRef.child(callSid).set({account_number: accountNumber});
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
	
	respTwiml.say('We got your number!.', { voice:'woman', language:'en-gb'});
    res.send(respTwiml);
});

app.post('/daonvoice/register', twilio.webhook({
	validate:validateTwilioAuth
}), function(req, res) {
	var baseURL = req.protocol + "://" + req.get('host');
	var respTwiml = new twilio.TwimlResponse();
	
	respTwiml.say('We got your number!.', { voice:'woman', language:'en-gb'});
    res.send(respTwiml);
});

var port = Number(process.env.PORT || 5000);
app.listen(port, function() {
  console.log("Listening on " + port);
});
