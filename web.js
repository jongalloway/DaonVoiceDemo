// web.js
var express = require("express");
var logfmt = require("logfmt");
var twilio = require('twilio');
var app = express();

app.use(logfmt.requestLogger());

app.use(express.urlencoded());

app.get('/', function(req, res) {
  res.send('Daon Voice Demo');
});


app.post('/daonvoice/greet', twilio.webhook({
	validate:false
}), function(req, res) {
	var respTwiml = new twilio.TwimlResponse();
	var baseURL = req.protocol + "://" + req.get('host');

	respTwiml.say('Welcome to day on Social Services.', { voice:'woman', language:'en-gb'});
	
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
	validate:false
}), function(req, res) {
	var baseURL = req.protocol + "://" + req.get('host');
	var respTwiml = new twilio.TwimlResponse();
	
	respTwiml.say('We got your number!.', { voice:'woman', language:'en-gb'});

	//Get Number

	//Retrieve record and handle error

	//If regiestered forward to verification

	//If not registered forward to registration
	
    res.send(respTwiml);
});

app.post('/daonvoice/verify', twilio.webhook({
	validate:false
}), function(req, res) {
	var baseURL = req.protocol + "://" + req.get('host');
	var respTwiml = new twilio.TwimlResponse();
	
	respTwiml.say('We got your number!.', { voice:'woman', language:'en-gb'});
    res.send(respTwiml);
});

app.post('/daonvoice/register', twilio.webhook({
	validate:false
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
