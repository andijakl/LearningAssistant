module.exports = {
    translation: {
        WELCOME: "Hi and welcome to voice learning! I can help you understand the most important concepts of your courses. First, please tell me your first name!",
        WELCOME_REPROMPT: "Please tell me your first name.",
        WELCOME_PERSONALIZED: "Welcome back {{studentName}}! {{prompt}}",
        //WELCOME_PERSONALIZED: "Welcome back <alexa:name type='first' personId='{{personId}}' />! <break /> {{prompt}}",
        WELCOME_PERSONALIZED_REPROMPT: "Would you like to resume your last course or start another course?",
        AVAILABLE_COURSES: "Hi {{studentName}}. I'm happy to help you with learning for your courses. I have content for these courses: {{availableTrainings}}. Which course should I start?",
        AVAILABLE_COURSES_REPROMPT: "Please choose one of these courses: {{availableTrainings}}.",
        AVAILABLE_COURSES_LIST: "You can choose one of these available courses: {{availableTrainings}}.",
        SELECTED_COURSE_START_TRAINING: "You chose the course: {{currentTrainingName}}. Let's get started!",
        RESUMING_COURSE_START_TRAINING: "Resuming course {{currentTrainingName}}.",
        RESTART_COURSE_START_TRAINING: "Restarting course {{currentTrainingName}}.",
        HELP_PROMPT: "I'm the teaching assistant and can ask you questions to help you learn for your courses. It works like a quiz!",
        GENERIC_REPROMPT: "How can I help you?",
        YES: "true",
        NO: "false",
        TRAINING_QUESTION_INTRO: "Question {{questionNumber}}: ",
        TRAINING_YES_NO_OPTIONS: "True or false?",
        TRAINING_REPEAT_ANSWER: "You said {{answerAsText}}.",
        TRAINING_REPEAT_NUMERIC_ANSWER: "You chose answer {{answerAsInt}}: {{answerText}}.",
        TRAINING_ANSWER_CORRECT: "Congratulations, the answer is correct!",
        TRAINING_ANSWER_WRONG: "Sorry, your answer was wrong.",
        TRAINING_FINISHED_NO_MORE_QUESTIONS: "I don't have any further questions for you right now.",
        TRAINING_FINISHED: "This training session is finished! You got a score of {{score}} out of {{questionNumber}}. You already finished {{finishedTrainings}} trainings.",
        TRAINING_FINISHED_NO_RESTART: "Thanks for training today. I hope I was able to help. Good bye!",
        TRAINING_RESTART_PROMPT: "Would you like to train again?",
        DELETE_DATA_CONFIRMED: "I have deleted your personal data. Please start the skill again if you would like to train again. See you next time!",
        FALLBACK_WHILE_TRAINING: "I can't do that while you're in the middle of a training. Plese finish your training first!",
        FALLBACK_WHILE_NAME: "I can'd do that right now. Please tell me your name first.",
        FALLBACK_GENERIC: "I can'd do that right now.",
        ERROR_NOT_IN_TRAINING_MODE: "You are currently not in training mode.",
        ERROR_COURSE_NOT_UNDERSTOOD: "Sorry, I did not get which course you would like to start. Please try again!",
        ERROR_COURSE_NOT_FOUND: "Sorry, I was unable to match your selection {{userTrainingName}} to any of the available trainings. Please try again or contact the skill administrators!",
        ERROR_RESUME_NO_COURSE_STARTED: "You have not started a course yet. Please choose a course first!",
        ERROR_RESUME_COURSE_WRONG_STATE: "I understood that you'd like to resume the previous course. This is not possible right now.",
        ERROR_STUDENT_NAME_WHEN_NOT_EXPECTED: "I understood a name, but did not expect that. Please repeat what you wanted to say in case I misunderstood you.",
        ERROR_TRAINING_INVALID_ANSWER: "Your answer {{answerAsText}} is not valid for this question.",
        FALLBACK: "Sorry, I didn't catch that. Say that again please.", 
        FALLBACK_REPROMPT: "Say that again please.",
        ERROR: "Sorry, something went wrong. Please try again.",
        EXIT: "Goodbye!",
    }
};