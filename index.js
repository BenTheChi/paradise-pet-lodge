"use strict"
const cheerio = require('cheerio')
const fs = require('fs')
const Entry = require('./Entry').Entry;
const Employee = require('./Employee').Employee;

//Use to extract date
// $('td.fc3').each((i, el) => {
//     console.log($(el).text())
// })

const lengthOfTime = (filename) => {
    //TODO, figure out the length of time based on the filename/package type
    return .25
}

const parseWalkList = (file) => {
    const allEntries = []
    let run, name, sex, age, breed, request, out, timeRequest = null;
    let checkedIn = true;
    let targetCount = 0;
    let htmlData = fs.readFileSync(file, 'utf-8')
    let time = lengthOfTime(file)

    function getTimeRequest(request){
        request = request.toLowerCase()

        if(!request){
            return null
        }

        return request.match(/((1[0-2])|[1-9])?(pm|am)/g)

        //TODO, parse apart the request and return the specific time, general time, or null
        //If it's split between two assign it based on filename (file)
    }

    htmlData = htmlData.replace(/(fc3)|(fc13)/g,"target")
    htmlData = htmlData.replace(/(fc8)|(fc15)/g,"out")
    htmlData = htmlData.replace(/(fc6)/g,"checked")
    htmlData = htmlData.replace(/(&nbsp;&nbsp;)/g," ")

    const $ = cheerio.load(htmlData);

    //TODO Add a way to dupliate/delete entries for the package deals
    $('div').each((i, el) => {
        const span = $(el).children().first()
        const value = span.text().trim()

        if($(el).hasClass('section') && name && breed){
            const entry = new Entry(run, name, sex, age, breed, request, out, checkedIn, timeRequest, time)
            allEntries.push(entry)

            run, name, sex, age, breed, request, out, timeRequest = null;
            checkedIn = true;
            targetCount = 0;
        }

        else if(span.hasClass('target')){
            switch(targetCount){
                case 0:
                    breed = value;
                    targetCount++;
                    break;
                case 1:
                    if(value.match(/\w{1,2} \d{1,2}/)){
                        run = value;
                    }
                    else{
                        name = value;
                        targetCount++;
                    }
                    break;
                case 2:
                    targetCount++;
                    break;
                case 3:
                    sex = value;
                    targetCount++;
                    break;
                case 4:
                    age = value;
                    targetCount++;
                    break;
                case 5:
                    request = value;
                    timeRequest = getTimeRequest(request);
                    targetCount++;
                    break;
            }
        }

        else if(span.hasClass('out')){
            out = value;
        }

        else if(span.hasClass('checked')){
            checkedIn = false;
        }
    })

    return allEntries;
}

const assignEntries = (employees, entries) => {
    const unassignable = []
    let counter = 0
    let max = employees.length - 1

    function increaseCounter(){
        if(counter++ >= max){
            counter = 0
        }
    }

    entries.forEach((entry) => {
        let startCount = counter
        do {
            let AmTimeLeft = employees[counter].AmTimeLeft
            let PmTimeLeft = employees[counter].PmTimeLeft
            if(AmTimeLeft <= 0 && PmTimeLeft <= 0){
                increaseCounter()
                continue
            }
            if(entry.timeRequest){
                if(entry.timeRequest.includes("am")){
                    if(AmTimeLeft - entry.time > 0){
                        employees[counter].entries.push(entry)
                        employees[counter].AmTimeLeft -= entry.time
                        increaseCounter()
                        return
                    }
                }
                else if(entry.timeRequest.includes("pm")){
                    if(PmTimeLeft - entry.time > 0){
                        employees[counter].entries.push(entry)
                        employees[counter].PmTimeLeft -= entry.time
                        increaseCounter()
                        return
                    }
                }
            }

            if(AmTimeLeft > PmTimeLeft){
                if(AmTimeLeft - entry.time > 0){
                    employees[counter].entries.push(entry)
                    employees[counter].AmTimeLeft -= entry.time
                    increaseCounter()
                    return
                }
            }
            else{
                if(PmTimeLeft - entry.time > 0){
                    employees[counter].entries.push(entry)
                    employees[counter].PmTimeLeft -= entry.time
                    increaseCounter()
                    return
                }
            }

            increaseCounter()
        } while (counter != startCount);
        
        //This only applies once if none of the employees can take the shift
        unassignable.push(entry)
    })

    return employees
    // console.log(employees)
}

const employees = []
let allEntries = []

//Adding interface to do this later
employees.push(new Employee("Ben", 9, 12))
employees.push(new Employee("Sarah", 12.5, 14.5))
employees.push(new Employee("John", 15, 18))

//TODO Add a loop here for each walkList in the schedules folder
allEntries = allEntries.concat(parseWalkList('schedules/morningewalk3.html'))

console.log("Total Entries " + allEntries.length)
assignEntries(employees, allEntries).forEach((employee) => {
    console.log("NEW EMPLOYEE: " + employee.name)
    console.log(employee.entries.length)
})
