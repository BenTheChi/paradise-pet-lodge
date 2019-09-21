#!/usr/bin/env node
'use strict';
const readline = require('readline')
const fs = require('fs')
const Employee = require('./Employee').Employee;
const parseWalkList = require('./index').parseWalkList;
const assignEntries = require('./index').assignEntries;
const assignBuilding = require('./index').assignBuilding;
const mergeTotals = require('./index').mergeTotals;
const printResults = require('./index').printResults;
const path = require('path')
const chalk = require('chalk');

const main = readline.createInterface(process.stdin, process.stdout);
let employees = []
let unassignable = []

const recursiveAsyncReadLine = function () {
    main.question(chalk.magenta(`\n------------------------------------------------------------------\n`) + 
    chalk.bgMagenta('1- ') + chalk.black.bgMagenta("Add Employee") +
    chalk.bgMagenta('\n2- ') + chalk.black.bgMagenta("Print Employees") +
    chalk.bgMagenta('\n3- ') + chalk.black.bgMagenta("Assign and Print Entries") +
    chalk.bgMagenta('\n4- ') + chalk.black.bgMagenta("Print Unassignable Entries") +
    chalk.bgMagenta('\n5- ') + chalk.black.bgMagenta("Quit") +
    chalk.green('\nPlease type a number from the menu above: '), function (answer) {
        switch(parseInt(answer)){
            case 1:
                let employeeName = "";
                let employeeTimeIn = 0;
                let employeeTimeOut = 0;
                console.log(chalk.magenta("------------------------------------------------------------------"))

                main.question(chalk.blue("What is the employee's name? - "), (name) => {
                    employeeName = name

                    main.question(chalk.blue("Clock In Time? (hh:mm) - "), (timeIn) => {
                        if(!timeIn.match(/[0-1]?\d:\d\d/g)){
                            console.log(chalk.red("Invalid input.  Try again."))
                            recursiveAsyncReadLine()
                            return
                        }

                        const timeArray = timeIn.split(":")
                        employeeTimeIn = parseFloat(timeArray[0]) + parseFloat(timeArray[1]/60)

                        main.question(chalk.blue("Clock Out Time? (hh:mm) - "), (timeOut) => {
                            if(!timeOut.match(/[0-1]?\d:\d\d/g)){
                                console.log(chalk.red("Invalid input.  Try again."))
                                recursiveAsyncReadLine()
                                return
                            }

                            const timeArray = timeOut.split(":")
                            employeeTimeOut = parseFloat(timeArray[0]) + parseFloat(timeArray[1]/60)
                            employees.push(new Employee(employeeName, employeeTimeIn, employeeTimeOut))

                            recursiveAsyncReadLine()
                        })
                    })
                })
                break;
            case 2:
                console.log("")
                console.log(chalk.black.bgGreen("!!!!!!!!!!!!!!!!!!!---------EMPLOYEES WORKING TODAY---------!!!!!!!!!!!!!!!!!!!\n"))
                employees.forEach((employee) => {
                    console.log(chalk.black.bgCyan(employee.name.toUpperCase()))
                    console.log(chalk.blue("START: ") + employee.formattedTimeIn())
                    console.log(chalk.blue("END: ") + employee.formattedTimeOut() + "\n")
                })
                break;
            case 3:
                //Use to extract date
                // $('td.fc3').each((i, el) => {
                //     console.log($(el).text())
                // })

                let allEntries = []
                let buildings = new Set()
                let totals = new Map()

                //Loop through each HTML schedule and parse it into allEntries
                const directoryPath = path.join(process.cwd(),'schedules')
                const files = fs.readdirSync(directoryPath)
                
                if(!files){
                    return console.log('Unable to scan directory: ' + err);
                }

                files.forEach((file) => {
                    let walkInfo = parseWalkList('schedules/' + file)
                    allEntries = allEntries.concat(walkInfo.allEntries)
                    buildings = new Set([...buildings, ...walkInfo.buildings])
                    totals = mergeTotals(totals, walkInfo.totals)
                })
                
                // console.log("Total Entries " + allEntries.length)
                let buildingInfo = assignBuilding(employees, buildings, totals)
                if(buildingInfo.unassignable.length > 0){
                    buildingInfo.unassignable.forEach((building) => {
                        console.log("Building " + building + " is unassignable")
                    })
                }
                else{
                    employees = buildingInfo.employees;
                    const entries = assignEntries(employees, allEntries)
                    unassignable = entries.unassignable
                    printResults(entries)
                    console.log(chalk.magenta("\n------------------------------------------------------------------"))
                }

                break;
            case 4:
                console.log("")
                console.log(chalk.black.bgRed("!!!!!!!!!!!!!!!!!!!---------UNASSIGNABLE ENTRIES---------!!!!!!!!!!!!!!!!!!!"))
                console.log(chalk.red("\t\tNumber of unassignable entries: ") + unassignable.length + "\n")

                unassignable.forEach((entry) => {
                    console.log(chalk.blue("RUN:") + entry.run + chalk.blue("  NAME:") + entry.name + chalk.blue("  SEX:") + entry.sex + chalk.blue("  AGE:") + entry.age + chalk.blue("  BREED:") + entry.breed)
                    if(entry.timeRequest){
                        console.log(chalk.blue("TIME REQUEST:") + entry.timeRequest)
                    }
                    if(entry.request){
                        console.log(chalk.blue("REQUEST:") + entry.request)
                    }
                    if(entry.out){
                        console.log(chalk.blue("OUT:") + entry.out)
                    }
                    if(entry.special){
                        console.log(chalk.blue("SPECIAL:") + entry.special)
                    }
                    console.log("")
                })

                break;
            case 5:
                return main.close()
            default:
                console.log(chalk.red("Invalid input.  Try again."))
        }

      recursiveAsyncReadLine();
    });
  }

  recursiveAsyncReadLine()