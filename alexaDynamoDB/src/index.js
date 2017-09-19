'use strict';

//---------REQUIREMENTS
const Alexa = require('alexa-sdk');
const AWS = require('aws-sdk');
const docClient = new AWS.DynamoDB.DocumentClient({region: 'us-east-1'});

//---------MESSAGES
var WELCOME_MESSAGE = "Welcome to ReadWriter! Say start if you want me to begin . " ;
var TELL_ME_MESSAGE = "Tell me something ";
var EXIT_SKILL_MESSAGE = "Thanks for playing. Come back soon ! ";
var HELP_MESSAGE = "I know lots of things about the United States.  You can ask me about a city, and I'll tell you what I know. What would you like to do?";
var FOUND_MESSAGE = "Found it . "
var SEARCHING = "Searching for it . "
var NOT_FOUND = "Did not find it. "
var ADDIT = "Do you want me to add it to your list? "
var SKILL_NAME = "Listy Skill!";
var USE_CARDS_FLAG = false;
var TEMPITEM;
var RESPONSE = "";
var counter = 0;

//--------STATES

var states = {
    START: "_START",
    INFO: "_INFO",
};

//---------HANDLERS definition
const handlers = {
    "LaunchRequest": function() {
         console.log("Starting here!");
        this.handler.state = states.START;
        this.emitWithState("Start");
    },
    "InfoIntent": function() {
         console.log("Init state + InfoIntent!");
        this.handler.state = states.INFO;
        this.emitWithState("Info");
    },
    "AnswerIntent": function() {
         console.log("Init state + AnswerIntent!");
        this.handler.state = states.START;
        this.emitWithState("AnswerIntent");
    },
    "AMAZON.YesIntent": function(){
    this.handler.state=states.INFO;
    this.emitWithState("Info");
    },
    "AMAZON.NoIntent": function(){
    this.handler.state=states.START;
    this.emit(":tell", EXIT_SKILL_MESSAGE);
    },
    "AMAZON.HelpIntent": function() {
        this.emit(":ask", HELP_MESSAGE, HELP_MESSAGE);
    },
    "Unhandled": function() {
    console.log("Init state + Unhandled");
        this.handler.state = states.START;
        this.emitWithState("Start");
    }
};

//-----------Handler for the state START

var startHandlers = Alexa.CreateStateHandler(states.START,{
    "Start": function() {
    console.log("StartHandler + Start intent!");
    this.emit(":ask", WELCOME_MESSAGE);
     },
    "AnswerIntent": function() {
         console.log("StartHandler + AnswerIntent");
        this.handler.state=states.INFO;
        this.emitWithState("Info");
     },
    "InfoIntent": function() {
         console.log("StartHandler + InfoIntent");
        this.handler.state = states.INFO;
        this.emitWithState("Info");
     },
    "AMAZON.StopIntent": function() {
         console.log("StartHandler + StopIntent");
        this.emit(":tell", EXIT_SKILL_MESSAGE);
     },
    "AMAZON.CancelIntent": function() {
        this.emit(":tell", EXIT_SKILL_MESSAGE);
     },
    "AMAZON.HelpIntent": function() {
        this.emit(":ask", HELP_MESSAGE, HELP_MESSAGE);
     },
    "Unhandled": function() {
        this.emitWithState("Start");
     }
});

//-----------Handler for the state INFO

var infoHandlers = Alexa.CreateStateHandler(states.INFO,{
  "Info": function() {
      console.log("InfoHandler + InfoIntent!");
        this.emitWithState("AskQuestion");
    },
  "AskQuestion": function() {
           this.emit(":ask", TELL_ME_MESSAGE, TELL_ME_MESSAGE);
    },
  "AnswerIntent": function() {
      var that = this;
        console.log("InfoHandler + AnswerIntent");
      var response = "";
      var heard = getSlots(this.event.request.intent.slots);
      console.log("You said : " + heard);

//-------- Defining the first promise which checks DynamoDB for the item
  var presentpromise = new Promise(function(resolve,reject){
      var paramz = {          //DEFINING the object to pass, you have to pass the primary key to retrieve an object
            Key: {
                "speech": heard
            },
            TableName: 'first'    // the DynamoDB table from where you want to retrieve
        };
      docClient.get(paramz,function(err,data){
          if(err){
              console.log("Error occurred!");
              reject("SOME_ERR");
          }else{
              console.log("read from DynamoDB:",data["Item"]);
              if(data["Item"]===undefined || data["Item"]===null){    //if the object is not present, it'll be undefined
                  resolve("NOT_FOUND");
              }else{
                resolve("FOUND");       // if the object not null, we take that it is present, as we do not have to extract a specific value
              }
          }
          });
     });

//--------- Defining the second promise which writes an object to DynamoDB
  var putpromise = new Promise(function(resolve,reject){
        var paramx = {
               TableName: 'first',
          Item:{
            "speech": heard,
            "status": "present"
         }
       };
       docClient.put(paramx,function(err,data){
          if(err){
            console.log("Error occured while writing!");
            reject("WRITE_ERROR");
          }else{
            console.log("Added item:",JSON.stringify(data,null,2));
            resolve("WRITTEN!");
          }
       });
     });

//------------- nested promise execution. This has putpromise inside presentpromise
  presentpromise.then(function(fromResolve){
    RESPONSE = "I heard ";
    RESPONSE += heard;
      if(fromResolve==="FOUND"){        // if resolved with "FOUND"
          console.log("Found it!");
          RESPONSE += ". I found it in the list . Tell me more.";
      }else if(fromResolve==="NOT_FOUND"){    // if resolved with "NOT_FOUND"
          console.log("Didn't find it!");
          RESPONSE += ". Not found. ";
          putpromise.then(function(fromResolve){
              console.log("Successfully written");
              RESPONSE += "Added it to the list.";
              console.log("Inside",RESPONSE);
              that.emit(":askWithCard",RESPONSE,RESPONSE,SKILL_NAME,heard);
          }).catch(function(fromReject){
              console.log("Writing error occured in this spot" + fromReject);
              RESPONSE += "Writing error occured. ";
          });
      }else{
          console.log("Don't know what happened!");
          response += "I don't know what happened!";
      }
      console.log(RESPONSE);
      that.emit(":askWithCard",RESPONSE,RESPONSE,SKILL_NAME,heard);
  }).catch(function(fromReject){
      response += "Some error occurred";
      this.emit(":askWithCard",RESPONSE,RESPONSE,SKILL_NAME,heard);
  });
  },

  "AMAZON.StartOverIntent": function() {
    this.emitWithState("INFO");
  },
  "AMAZON.StopIntent": function() {
    console.log("InfoHandler + StopIntent");
    this.emit(":tell", EXIT_SKILL_MESSAGE);
  },
  "AMAZON.CancelIntent": function() {
    this.emit(":tell", EXIT_SKILL_MESSAGE);
  },
  "AMAZON.HelpIntent": function() {
    this.emit(":ask", HELP_MESSAGE, HELP_MESSAGE);
  },
  "Unhandled": function() {
           console.log("InfoHandler + Unhandled!");
         this.emitWithState("AnswerIntent");
  }
});

//-----------------Standalone functions

function getSlots(slots){
    for (var slot in slots)
    {
        if (slots[slot].value !== undefined)
        {
                var iheard=slots[slot].value.toString().toLowerCase();
        //addtodynamo(iheard);
        return iheard;
        }
    }
    return "Sorry! I couldn't understand!";
};

function getRandom(min, max)
{
    return Math.floor(Math.random() * (max-min+1)+min);
};

exports.handler = (event, context) => {
    const alexa = Alexa.handler(event, context);
    //alexa.appId = APP_ID;
    alexa.registerHandlers(handlers, startHandlers, infoHandlers);
    alexa.execute();
};
