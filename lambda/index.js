"use strict";

// Warning: only deploy with Powershell 7, issues with "normal" PowerShell: https://github.com/alexa/ask-cli/issues/59

const Alexa = require("ask-sdk-core");
//const AWS = require("aws-sdk");
//const util  = require("./util");
const i18next = require("i18next"); 
//const sprintf = require("i18next-sprintf-postprocessor"); 
const sprintf       = require("sprintf-js").sprintf;
//const persistenceAdapter = require('ask-sdk-s3-persistence-adapter');
const { DynamoDbPersistenceAdapter } = require("ask-sdk-dynamodb-persistence-adapter");
// eslint-disable-next-line no-undef
const persistenceAdapter = new DynamoDbPersistenceAdapter({ tableName : process.env.DYNAMODB_TABLE_NAME });
const config = require("./config.js");
const trainingHandler = require("./trainingHandler.js");
const dbHandler = require("./dbHandler.js");
//import { getRequestType, getIntentName, getSlotValue, SkillBuilders } from 'ask-sdk-core';
//import * as Alexa from 'ask-sdk-core'
//import persistenceAdapter from 'ask-sdk-s3-persistence-adapter';

const languageStrings = {
    "en" : require("./i18n/en"),
    "de" : require("./i18n/de"),
};


// -------------------------------------------------------------------
// Launch intent handler

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
    },
    async handle(handlerInput) {
        let speakOutput = null;
        let repromptOutput = null;

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        // Reset saved reprompt output
        persistentAttributes.repromptOutput = null;

        if (persistentAttributes.studentName) {
            // TODO: Check if there is a course to resume!
            const speakQuestion = handlerInput.t("WELCOME_PERSONALIZED_REPROMPT");
            speakOutput = handlerInput.t("WELCOME_PERSONALIZED", {
                studentName: persistentAttributes.studentName,
                prompt: speakQuestion
            });
            repromptOutput = speakQuestion; 
            sessionAttributes.state = config.states.CHOOSE_COURSE;
        } else {
            speakOutput = handlerInput.t("WELCOME");
            repromptOutput = handlerInput.t("WELCOME_REPROMPT");
            // Initialize new user
            trainingHandler.initializeUser(sessionAttributes, persistentAttributes);
        }

        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


// -------------------------------------------------------------------
// Config Intent Handlers

const StudentNameIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "StudentNameIntent"
            //&& Alexa.getDialogState(handlerInput.requestEnvelope) === "COMPLETED"
            && sessionAttributes.state == config.states.STUDENT_NAME;
    },
    async handle(handlerInput) {
        // Get Slots
        const studentName = Alexa.getSlotValue(handlerInput.requestEnvelope, "StudentName");

        let speakOutput = null;
        let repromptOutput = null;

        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();

        if (sessionAttributes.state !== config.states.STUDENT_NAME)
        {
            // TODO handle case where we did not ask for the name
            speakOutput = "I understood a name, but did not expect that. Please repeat what you wanted to say in case I misunderstood you.";
            if (persistentAttributes.repromptOutput !== null) {
                speakOutput += " " + persistentAttributes.repromptOutput;
                repromptOutput = persistentAttributes.repromptOutput;
            }
        } else {
            // Update attributes
            sessionAttributes.state = config.states.CHOOSE_COURSE;
            persistentAttributes.studentName = studentName;
            
            const availableTrainings = await dbHandler.getTrainingNamesForSpeech();
            speakOutput = handlerInput.t("AVAILABLE_COURSES", {
                studentName: studentName,
                availableTrainings: availableTrainings
            });
            speakOutput = handlerInput.t("AVAILABLE_COURSES_REPROMPT", {
                availableTrainings: availableTrainings
            });
        }

        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

const ChooseCourseIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "ChooseCourseIntent"
            && sessionAttributes.state == config.states.CHOOSE_COURSE;
    },
    async handle(handlerInput) {
        // Get Slots
        const trainingNameSlot = Alexa.getSlot(handlerInput.requestEnvelope, "course");
        // Get actual main slot value, not the spoken synonym
        const userTrainingName = getCanonicalSlot(trainingNameSlot);

        let speakOutput = null;
        let repromptOutput = null;

        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        const userId = Alexa.getUserId(handlerInput.requestEnvelope);

        console.log("User selected training: " + userTrainingName);

        if (userTrainingName === undefined || userTrainingName === null) {
            speakOutput = "Sorry, I did not get which course you would like to start. Please try again!";
            const availableTrainings = await dbHandler.getTrainingNamesForSpeech();
            repromptOutput = "Please choose one of these courses: " + availableTrainings;
            speakOutput += " " + repromptOutput;
        } else {
            // Match slot value with available courses and get its ID from the DB
            const selectedTrainingInfo = await trainingHandler.selectTraining(userTrainingName, persistentAttributes);
            if (selectedTrainingInfo !== null) {
                // Training selected successfully
                let introOutput = `You chose the course: ${persistentAttributes.currentTrainingName}. Let's get started! `;
                // Get question
                ({speakOutput, repromptOutput} = await trainingHandler.startNewTraining(userId, sessionAttributes, persistentAttributes));
                speakOutput = introOutput + " " + speakOutput;
            } else {
                // Unable to match slot to training in DB
                speakOutput = `Sorry, I was unable to match your selection ${userTrainingName} to any of the available trainings. Please try again or contact the skill administrators!`;
                const availableTrainings = await dbHandler.getTrainingNamesForSpeech();
                repromptOutput = "Please choose one of these courses: " + availableTrainings;
                speakOutput += " " + repromptOutput;
            }
        }

        
        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

// const ListTrainingsApiHandler = {
//     canHandle(handlerInput) {
//         return util.isApiRequest(handlerInput, "ListTrainings");
//     },
//     async handle(handlerInput) {
//         console.log("Api Request [RecordColor]: ", JSON.stringify(handlerInput.requestEnvelope.request, null, 2));
//         // First get our request entity and grab the color passed in the API call
//         //const args = util.getApiArguments(handlerInput);
//         //const color = args.color;
//         const availableTrainings = await dbHandler.getTrainingNamesForSpeech();

//         let response = {
//             apiResponse: {
//                 CourseNameProperty : availableTrainings
//             }
//         };
//         console.log("Api Response [ListTrainings]: ", JSON.stringify(response, null, 2));
//         return response;
//     }
// };

const ListCoursesIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "ListCoursesIntent"
            && sessionAttributes.state !== config.states.TRAINING;
    },
    async handle(handlerInput) {
        let speakOutput = null;
        let repromptOutput = null;

        // Get attributes
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
   
        const availableTrainings = await dbHandler.getTrainingNamesForSpeech();
        speakOutput = `You can choose one of these available courses: ${availableTrainings}. `;

        // Keep reprompt output from previous question
        repromptOutput = persistentAttributes.repromptOutput;

        speakOutput += " " + repromptOutput;
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};

const ResumeCourseIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "ResumeCourseIntent"
            && (sessionAttributes.state == config.states.CHOOSE_COURSE
                || sessionAttributes.state == config.states.FINISHED);
    },
    async handle(handlerInput) {
        let speakOutput = null;
        let repromptOutput = null;

        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        const userId = Alexa.getUserId(handlerInput.requestEnvelope);

        if (sessionAttributes.state === config.states.CHOOSE_COURSE)
        {
            if (persistentAttributes.currentTrainingName !== null) {
                // Able to resume
                let introOutput = `Resuming course ${persistentAttributes.currentTrainingName}.`;
                ({speakOutput, repromptOutput} = await trainingHandler.startNewTraining(userId, sessionAttributes, persistentAttributes));
                speakOutput = introOutput + " " + speakOutput;
            } else {
                speakOutput = "You have not started a course yet. Please choose a course first!";
                if (persistentAttributes.repromptOutput !== null) {
                    speakOutput += " " + persistentAttributes.repromptOutput;
                    repromptOutput = persistentAttributes.repromptOutput;
                }
            }
        } else {
            speakOutput = "I understood that you'd like to resume the previous course. This is not possible right now. ";
            if (persistentAttributes.repromptOutput !== null) {
                speakOutput += " " + persistentAttributes.repromptOutput;
                repromptOutput = persistentAttributes.repromptOutput;
            }
        }
        
        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


// -------------------------------------------------------------------
// Training intent handlers

const YesNoIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        // TODO: can combine both yes&no intent handlers here!
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.YesIntent" 
                || Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.NoIntent")
            && (sessionAttributes.state == config.states.TRAINING
                || sessionAttributes.state == config.states.FINISHED);
    },
    async handle(handlerInput) {
        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        const userId = Alexa.getUserId(handlerInput.requestEnvelope);
        const isYes = Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.YesIntent";

        let {speakOutput, repromptOutput}  = await trainingHandler.handleYesNoIntent(isYes, userId, sessionAttributes, persistentAttributes);
        
        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);
        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }
};


// const NoIntentHandler = {
//     canHandle(handlerInput) {
//         const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
//         return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
//             && Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.NoIntent"
//             && (sessionAttributes.state == config.states.TRAINING
//                 || sessionAttributes.state == config.states.FINISHED);
//     },
//     async handle(handlerInput) {
//         // Get attributes
//         const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
//         const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
//         const userId = Alexa.getUserId(handlerInput.requestEnvelope);

//         let {speakOutput, repromptOutput} = await trainingHandler.handleYesNoIntent(false, userId, sessionAttributes, persistentAttributes);
        
//         repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

//         if (repromptOutput === -1) {
//             // Stop the skill
//             return CancelAndStopIntentHandler.handle(handlerInput);
//         }
        
//         return handlerInput.responseBuilder
//             .speak(speakOutput)
//             .reprompt(repromptOutput)
//             .getResponse();
//     }
// };

const NumericAnswerIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "NumericAnswerIntent"
            && sessionAttributes.state == config.states.TRAINING;
    },
    async handle(handlerInput) {
        // Get attributes
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const persistentAttributes = await handlerInput.attributesManager.getPersistentAttributes();
        const userId = Alexa.getUserId(handlerInput.requestEnvelope);
        const numericAnswer = Alexa.getSlotValue(handlerInput.requestEnvelope, "numericAnswer");

        let {speakOutput, repromptOutput} = await trainingHandler.handleNumericIntent(numericAnswer, userId, sessionAttributes, persistentAttributes);
        

        repromptOutput = await saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput);

        if (repromptOutput === -1) {
            // Stop the skill
            return CancelAndStopIntentHandler.handle(handlerInput);
        }

        
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(repromptOutput)
            .getResponse();
    }

};

// -------------------------------------------------------------------
// Utility functions

async function saveAttributes(speakOutput, repromptOutput, sessionAttributes, persistentAttributes, handlerInput) {
    if (repromptOutput === null) {
        repromptOutput = speakOutput;
    }

    // Save state
    persistentAttributes.repromptOutput = repromptOutput;
    handlerInput.attributesManager.setPersistentAttributes(persistentAttributes);
    await handlerInput.attributesManager.savePersistentAttributes();
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    return repromptOutput;
}

// Get the "original" slot value, not the actual spoken synonym
// From: https://stackoverflow.com/questions/59569514/how-do-i-get-the-canonical-slot-value-out-of-an-alexa-request
const getCanonicalSlot = (slot) => {
    if (slot.resolutions && slot.resolutions.resolutionsPerAuthority.length) {
        for (let resolution of slot.resolutions.resolutionsPerAuthority) {
            if (resolution.status && resolution.status.code === "ER_SUCCESS_MATCH") {
                return resolution.values[0].value.name;
            }
        }
    }
};
  
// -------------------------------------------------------------------
// Generic input handlers
const DeleteDataIntentHandler = {
    canHandle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "DeleteDataIntent"
            && Alexa.getDialogState(handlerInput.requestEnvelope) === "COMPLETED"
            && (sessionAttributes.state == config.states.CHOOSE_COURSE
                || sessionAttributes.state == config.states.FINISHED);
    },
    async handle(handlerInput) {
        await handlerInput.attributesManager.deletePersistentAttributes();
        
        const speakOutput = "I have deleted your progress and data. See you next time!";
        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('Was kann ich noch für dich tun?')
            .withShouldEndSession(true)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
            && Alexa.getDialogState(handlerInput.requestEnvelope) === "COMPLETED";
    },
    handle(handlerInput) {
        // TODO
        const speakOutput = "I'm the teaching assistant and can ask you questions to help you learn for your courses. It works like a quiz!";

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.CancelIntent"
                || Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.StopIntent");
    },
    handle(handlerInput) {
        const speakOutput = "Goodbye!";
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        // handle fallback intent, yes and no when playing a game
        // for yes and no, will only get here if and not caught by the normal intent handler
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
        && Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.FallbackIntent";
    },
    handle(handlerInput) {
        // TODO Handle
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `Fallback handler for ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    },
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest";
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.error(`Error handled: ${error.message}`);
        console.error("Error stack", JSON.stringify(error.stack));
        console.error("Error", JSON.stringify(error));
        const speakOutput = `Sorry, I had trouble doing what you asked. Please try again. Error stack: ${error.stack}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};


const LocalizationInterceptor = {
    process(handlerInput) {
        i18next
            .init({
                lng: handlerInput.requestEnvelope.request.locale,
                fallbackLng: "en", // fallback to EN if locale doesn't exist
                overloadTranslationOptionHandler: sprintf.overloadTranslationOptionHandler,
                resources: languageStrings,
                returnObjects: true
            });
 
        handlerInput.t = (key, opts) => {
            const value = i18next.t(key, {...{interpolation: {escapeValue: false}}, ...opts});
            if (Array.isArray(value)) {
                return value[Math.floor(Math.random() * value.length)]; // return a random element from the array
            } else {
                return value;
            }
        };
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        // Launch
        LaunchRequestHandler,
        // Alexa Converstaions
        //ListTrainingsApiHandler,
        // Config
        StudentNameIntentHandler,
        // Training
        NumericAnswerIntentHandler,
        YesNoIntentHandler,
        // Course logic
        ChooseCourseIntentHandler,
        ListCoursesIntentHandler,
        ResumeCourseIntentHandler,
        // Data handling
        DeleteDataIntentHandler,
        // Generic Alexa
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        FallbackIntentHandler,
        IntentReflectorHandler, // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    )
    .withPersistenceAdapter(
        persistenceAdapter
    )
    .addErrorHandlers(
        ErrorHandler,
    )
    .addRequestInterceptors(LocalizationInterceptor)
    .lambda();
