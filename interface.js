
'use strict';
var inquirer = require('inquirer-recursive');
console.log(inquirer)
// inquirer.registerPrompt('recursive', require('inquirer-recursive'));
inquirer.Prompt([{
    type: 'recursive',
    message: 'Add a new user ?',
    name: 'users',
    prompts: [
        {
			type: 'input',
			name: 'name',
			message: 'What is user\'s name?',
			validate: function (value) {
				if ((/.+/).test(value)) { return true; }
				return 'name is required';
			}
		}, {
            type: 'input',
            name: 'age',
            message: 'How old is he?',
            validate: function (value) {
                var digitsOnly = /\d+/;
                if (digitsOnly.test(value)) { return true; }
                return 'Invalid age! Must be a number genius!';
            }
        }
    ]
}]).then(function(answers) {
    console.log(answers.users);
    /*
    OUTPUT :
    [
        {
            name: 'Brendan Eich',
            age: '42',
        }, {
            name: 'Jordan Walke',
            age: '13',
        },
        ...
    ]
    */
});

// const readline = require('readline')

// const rl = readline.createInterface({
//     input: process.stdin,
//     output: process.stdout
// });
// let input = 1;

// rl.question('Please choose from the memu below:\n 1. Add Employee\n', (answer) => {
//     console.log(answer);

//     rl.close();
// });


// const stdIn = process.stdin;
// let input = 1;
// stdIn.setEncoding('utf-8')



// while(input != 5){
//     console.log("Please choose from the memu below:")
//     console.log("1. Add Employee")
//     console.log("2. Load HTML Entries")
//     console.log("3. Create Employee Schedules")
//     console.log("4. Print Info")
//     console.log("5. Quit")

//     stdIn.once('data', (data) => {
//         input = data
//     })
// }
