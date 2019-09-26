"use strict"
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const Entry = require('./Entry').Entry;
const Employee = require('./Employee').Employee;
const gSheets = require('./gSheets');

const chalk = require('chalk');

let employees = parseEmployeeList('employees/Export_Schedule_Print.csv');
// let entries = parseWalkList('schedules/activities schedule.csv')
let allEntries = []
let unassignable = []
let buildings = new Set()
let totals = new Map()

//Loop through each schedule and parse it into allEntries
const directoryPath = path.join(process.cwd(),'schedules')
const files = fs.readdirSync(directoryPath)

if(!files){
    console.log('Unable to scan directory: ' + err);
}
else{
    let dateTitle = null;
    
    files.forEach((file) => {
        let walkInfo = parseWalkList('schedules/' + file)
        allEntries = allEntries.concat(walkInfo.allEntries)
        buildings = new Set([...buildings, ...walkInfo.buildings])
        // console.log(walkInfo.totals);
        totals = mergeTotals(totals, walkInfo.totals)
        if(!dateTitle){
            dateTitle = walkInfo.dateTitle;
        }
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
        let entries = assignEntries(employees, allEntries)
        employees = entries.employees;

        let removedEmployees = [];
        let enoughTimeArray = enoughTimeInShift(employees)

        while(!enoughTimeArray.every(workedEnough => workedEnough)){
            console.log(enoughTimeArray)

            for(let i=0; i<enoughTimeArray.length; i++){
                if(!enoughTimeArray[i]){
                    //This i in employees array = i in enoughTimeInShift's returned array
                    let removedEmployee = employees.splice(i,1)[0];
                    removedEmployee.entries = [];
                    removedEmployees.push(removedEmployee);

                    entries = assignEntries(employees, allEntries);
                    employees = entries.employees;
                    break;
                }
            }

            enoughTimeArray = enoughTimeInShift(employees);
        }

        employees = employees.concat(removedEmployees);
        unassignable = entries.unassignable
    }

    console.log(employees);
    // gSheets.generateSchedules(dateTitle, employees, unassignable)
}

function enoughTimeInShift(employees){

    return employees.map((employee) => {
        if(employee.entries.length === 0){
            return false;
        }

        const total = employee.entries.reduce((total, entry) => {
            total + entry.time
        });

        if(total < (employee.timeOut - employee.timeIn)/2){
            return false;
        }

        return true;
    })
}

function getBuilding(run) {
    if(!run){
        console.log(chalk.red("THERE IS AN EMPTY RUN!\n"))
        return null
    }

    let building = run.charAt(0)
    if(building === "S"){
        return "D"
    }

    return building
}

function mergeTotals(original,incoming){
    incoming.forEach((building) => {
        let value = incoming.get(building)

        if(original.has(building)){
            original.set(building, original.get(building) + value)
        }
        else{
            original.set(building, value)
        }
    })

    return original
}

function parseEmployeeList(file){
    let employeeData = fs.readFileSync(file, 'utf-8');
    let employeeName = "";
    let employeeTimeIn = 0;
    let employeeTimeOut = 0;
    let employees = [];

    function timeToNum(timeString){
        const timeArray = timeString.split(":");
        let hour = parseFloat(timeArray[0]);

        if(timeArray[1].includes("pm")){
            hour += 12; 
        }

        const minute = parseFloat(timeArray[1].replace(/am|pm/, ""))/60

        return hour + minute;
    }

    employeeData = employeeData.trim().replace(/"/g,"");
    employeeData = employeeData.replace(/Dog Walkers\n/g, "");
    employeeData = employeeData.replace(/,Dog Exercise,/g, "");

    let employeeDataArray = employeeData.split('\n')
    employeeDataArray.shift()
    
    for(let i=0; i<employeeDataArray.length; i++){
        if(i%2 === 0){
            let times = employeeDataArray[i].split(' - ');
            employeeTimeIn = timeToNum(times[0]);
            employeeTimeOut = timeToNum(times[1]);
            continue;
        }

        //Only take the name.  Ignore total time.
        employeeName = employeeDataArray[i].split(',')[1];

        employees.push(new Employee(employeeName, employeeTimeIn, employeeTimeOut))

        //Reset employee entry
        employeeName = "";
        employeeTimeIn = 0;
        employeeTimeOut = 0;
    }

    return employees
}

function parseWalkList(file){
    const allEntries = []
    const buildings = new Set()
    const totals = new Map()
    let walkData = fs.readFileSync(file, 'utf-8');
    walkData = walkData.trim().replace(/"/g,"").replace(/,Schedule/g,"");
    function getTimeRequest(request){
        request = request.toLowerCase()

        if(!request){
            return null
        }

        return request.match(/((1[0-2])|[1-9])?(pm|am)/g)
    }

    //Save the date title from the first line
    let dateTitle = walkData.substring(0, walkData.indexOf("\n"));
    if(dateTitle.length > 45){
        dateTitle = walkData.substring(0, walkData.indexOf("\r"));
    }

    //Remove every line that has the datetitle
    const regEx = new RegExp(dateTitle+"(\n|\r)","g");
    const walkDataArray = walkData.replace(regEx,"").split('\n');
    walkDataArray.forEach((row, index) => {
        let rowArray = row.trim().split(',');
        
        let time = .25;
        if(rowArray[9].includes("Play")){
            time = .5;
        }
        
        const run = rowArray[14];
        const name = rowArray[16];
        const sex = rowArray[20];
        const age = rowArray[22];
        const breed = rowArray[24];
        const request = rowArray[32];
        const out = rowArray[27];
        const timeRequest = getTimeRequest(request);
        const special = "";

        if(run.match(/\w{1,2} +\d{1,2}/)){
            let building = getBuilding(run)
            buildings.add(building)

            if(totals.has(building)){
                totals.set(building,totals.get(building)+1)
            }
            else{
                totals.set(building,1)
            }
        }

        try {
            //Make a separate entry for each time request
            if(timeRequest){
                timeRequest.forEach((timeRequestEntry) => {
                    const entry = new Entry(run, name, sex, age, breed, request, out, special, timeRequestEntry.toLowerCase(), time)
                    allEntries.push(entry)
                })
            } 
            else{
                const entry = new Entry(run, name, sex, age, breed, request, out, special, timeRequest, time)
                allEntries.push(entry)
            }
        } catch (error) {
            console.log(error)
        }
        

        // if(index === 2){
        //     rowArray.forEach((value, i) => {
        //         console.log(i + ") " + value);
        //     })
        //     console.log("")
        // }
    })

    return {allEntries, buildings, totals, dateTitle};
}

function parseWalkListe(file){
    const allEntries = []
    const buildings = new Set()
    const totals = new Map()
    let run, name, sex, age, breed, request, out, timeRequest, special = null;
    let targetCount = 0;
    let htmlData = fs.readFileSync(file, 'utf-8')
    let time = .25
    let fileName = null

    function getTimeRequest(request){
        request = request.toLowerCase()

        if(!request){
            return null
        }

        return request.match(/((1[0-2])|[1-9])?(pm|am)/g)
    }

    // Pre parse the document to find the title
    htmlData = htmlData.replace(/(&nbsp;&nbsp;)/g," ")
    let $ = cheerio.load(htmlData);
    $('div').each((i, el) => {
        const span = $(el).children().first()
        const value = span.text().trim()

        if(span.hasClass('fc0') && !value.includes("Schedule for ")){
            const fileName = value
            let target = null
            let out = null
            let special = null
            let pkgPlay = null

            switch(fileName){
                case "Morning Walk to CS 7AM $8 Schedule":
                    target = /(fc3)|(fc10)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
                case "Morning Walk to CS 8AM $8 Schedule":
                    target = /(fc3)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
                case "Morning Walk to CS 9AM $8 Schedule":
                    target = /(fc3)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
                case "Morning Morning Walk $8 Schedule":
                    target = /(fc3)|(fc12)/g
                    out = /(fc7)/g
                    special = /(fc6)|(fc14)/g
                    break;
                case "Morning Morning W/S $8 Schedule": 
                case "Morning Morning W/S  $8 Schedule":
                    target = /(fc3)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
                case "Morning Afternoon W/S $8 Schedule":
                    target = /(fc3)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
                case "Afternoon Aftrn Walk $8 Schedule":
                    target = /(fc3)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
                case "Evening Afternoon Walk - $8 Schedule":
                    target = /(fc3)|(fc11)/g
                    out = /(fc8)|(fc15)/g
                    special = /(fc6)|(fc14)/g
                    break;
                case "Afternoon Pack Walk/Snug $8 Schedule":
                    target = /(fc3)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
                case "Evening Pkg Walk $8 Schedule":
                    target = /(fc3)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
                case "Evening Package Walk $8 Schedule":
                    target = /(fc3)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
                case "Morning Morning Prvt Ply $12 Schedule":
                    target = /(fc3)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
                case "Evening Aftrnoon Prvt Ply$12 Schedule":
                    target = /(fc3)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
                case "Morning Pkg Play $12 Schedule":
                    target = /(fc3)|(fc11)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    pkgPlay = /(fc0)/g
                    time = .5
                    break;
                case "Evening Pkg Play $12 Schedule":
                case "Afternoon Pkg Play $12 Schedule":
                    target = /(fc3)|(fc10)|(fc15)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    pkgPlay = /(fc0)/g
                    time = .5
                    break;
                default:
                    console.log("FILE NAME " + fileName + " NOT FOUND")
                    target = /(fc3)/g
                    out = /(fc8)/g
                    special = /(fc6)/g
                    break;
            }

            htmlData = htmlData.replace(target, "target")
            htmlData = htmlData.replace(out, "out")
            htmlData = htmlData.replace(special, "special")
    
            if(pkgPlay){
                htmlData = htmlData.replace(pkgPlay, "pkgPlay")
            }
    
            return false
        }
    })

    //Make the replacements for target, out, and special
    $ = cheerio.load(htmlData);
    htmlData = htmlData.replace(/(&nbsp;&nbsp;)/g," ")

    $('div').each((i, el) => {
        const span = $(el).children().first()
        const value = span.text().trim()

        if($(el).hasClass('section') && name && breed){
            //Make a separate entry for each time request
            if(timeRequest){
                timeRequest.forEach((timeRequestEntry) => {
                    const entry = new Entry(run, name, sex, age, breed, request, out, special, timeRequestEntry, time)
                    allEntries.push(entry)
                })
            } 
            else{
                const entry = new Entry(run, name, sex, age, breed, request, out, special, timeRequest, time)
                allEntries.push(entry)
            }
            run, name, sex, age, breed, request, out, timeRequest, special = null;
            targetCount = 0;
        }

        //Stopping the parsing here because we double up on Afternoon Pkg Play $12 Schedule
        else if(span.hasClass("pkgPlay") && value == "Evening Pkg Play $12 Schedule"){
            if(timeRequest){
                timeRequest.forEach((timeRequestEntry) => {
                    const entry = new Entry(run, name, sex, age, breed, request, out, special, timeRequestEntry, time)
                    allEntries.push(entry)
                })
            } 
            else{
                const entry = new Entry(run, name, sex, age, breed, request, out, special, timeRequest, time)
                allEntries.push(entry)
            }

            //Setting these to null so I don't make a repeat of the last entry
            timeRequest = null
            run = null
            name = null

            return false
        }
        
        else if(span.hasClass('target')){
            switch(targetCount){
                case 0:
                    breed = value;
                    targetCount++;
                break;
                case 1:
                    if(value.match(/\w{1,2} \d{1,2}/)){
                        let building = getBuilding(value)
                        run = value;
                        buildings.add(building)

                        if(totals.has(building)){
                            totals.set(building,totals.get(building)+1)
                        }
                        else{
                            totals.set(building,1)
                        }
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

        else if(span.hasClass('special')){
            special = value;
        }
    })

    if(run && name){
        if(timeRequest){
            timeRequest.forEach((timeRequestEntry) => {
                const entry = new Entry(run, name, sex, age, breed, request, out, special, timeRequestEntry, time)
                allEntries.push(entry)
            })
        }

        else{
            const entry = new Entry(run, name, sex, age, breed, request, out, special, timeRequest, time)
            allEntries.push(entry)
        }
    }

    return {allEntries, buildings, totals};
}

function assignEntries(employees, entries){
    const unassignable = []
    let counter = 0
    let max = employees.length - 1
    
    function increaseCounter(){
        counter++
        if(counter > max){
            counter = 0
        }
    }

    function convertToDecimalTime(timeRequest){
        if(!timeRequest){
            return null;
        }

        let timeNum = timeRequest.match(/\d+/g)

        if(!timeNum){
            return null
        }
        if(timeRequest.includes("am")){
            return parseInt(timeNum[0])
        }
        if(timeRequest.includes("pm")){
            return parseInt(timeNum[0]) + 12
        }

        return null;
    }

    entries.forEach((entry) => {        
        let startCount = counter
        do {
            let AmTimeLeft = employees[counter].AmTimeLeft
            let PmTimeLeft = employees[counter].PmTimeLeft
            let NoonTimeLeft = employees[counter].NoonTimeLeft
            let type = null
            let decimalTime = convertToDecimalTime(entry.timeRequest)

            const building = getBuilding(entry.run)
            if(!building){
                unassignable.push(entry)
                return
            }

            if(AmTimeLeft <= 0 && PmTimeLeft <= 0){
                increaseCounter()
                continue
            }
            if(!employees[counter].buildings.has(building)){
                if(employees[counter].buildings.size === 2){
                    increaseCounter()
                    continue
                }
            }
            
            if(decimalTime){
                if(decimalTime >= 14){
                    type = "pm";
                }
                else if(decimalTime >= 10){
                    type = "noon";
                }
                else{
                    type = "am";
                }
            }
            else if(!entry.timeRequest){
                type = null;
            }
            else if(entry.timeRequest.includes("am")){
                type = "am";
            }
            else if(entry.timeRequest.includes("pm")){
                type = "pm";
            }
            else if(entry.timeRequest.includes("noon")){
                type = "noon";
            }

            if(!type || type === "am"){
                if(AmTimeLeft >= entry.time){
                    employees[counter].entries.push(entry)

                    if(building != "O"){
                        employees[counter].buildings.add(building)
                    }

                    employees[counter].AmTimeLeft -= entry.time

                    increaseCounter()
                    return
                }
            }
            if(!type || type === "noon"){
                if(NoonTimeLeft >= entry.time){
                    employees[counter].entries.push(entry)

                    if(building != "O"){
                        employees[counter].buildings.add(building)
                    }

                    employees[counter].NoonTimeLeft -= entry.time
                    
                    increaseCounter()
                    return
                }
            }
            if(!type || type === "pm"){
                if(PmTimeLeft >= entry.time){
                    employees[counter].entries.push(entry)

                    if(building != "O"){
                        employees[counter].buildings.add(building)
                    }

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

    return {employees, unassignable}
}

function assignBuilding(employees, buildings, buildingTotals){
    const availableBuildings = Array.from(buildings);
    let unassignable = [];
    
    function findCombinations(){
        const combinations = new Map();
        let count = 0;

        //Don't use the last building (size-1) as it's already been accounted for in previous combinations
        while(count < availableBuildings.length-1){
            for(let i=count+1; i<availableBuildings.length; i++){
                const build1 = availableBuildings[count]
                const build2 = availableBuildings[i]
                const sum = buildingTotals.get(build1) + buildingTotals.get(build2)
                
                //Key = 2 building String ex-"AB".  Value = The total number of entries for both.
                combinations.set(build1+build2, sum)
            }

            count++
        }

        //Take the combinations Map and use insertion sort to put it in the array
        let sortedCombinations = [];
        
        //Converts the String building combination into a set
        //Then sorts it into an array based on total entries for that combination
        combinations.forEach((valueTotal, keyBuildings) => {            
            if(sortedCombinations.length === 0){
                sortedCombinations.push(keyBuildings)
                return
            }

            //Using an insertion sort + splice to skip over the element swapping
            for(let i=0; i<sortedCombinations.length; i++){
                // console.log(sortedCombinations[i] + combinations.get(sortedCombinations[i]))
                // console.log("vs")
                // console.log(keyBuildings + valueTotal)
                // console.log("")
                if(combinations.get(sortedCombinations[i]) <= valueTotal){
                    sortedCombinations.splice(i,0,keyBuildings)
                    return
                }
            }

            sortedCombinations.push(keyBuildings)
        })

        for(let i=0; i<sortedCombinations.length; i++){
            sortedCombinations[i] = new Set(sortedCombinations[i].split(""))
        }

        return sortedCombinations
    }
    
    let combinations = findCombinations()
    let counter = 0;
    let max = combinations.length - 1;
    
    for(let i=0; i<employees.length; i++){
        employees[i].buildings = combinations[counter];

        counter++
        if(counter > max){
            counter = 0;
        }
    }

    //FIX UNASSIGNABLE
    return {employees, unassignable}
}

function printResults(entries){
    console.log(chalk.black.bgGreen("!!!!!!!!!!!!!!!!!!!---------TODAY'S SCHEDULE---------!!!!!!!!!!!!!!!!!!!\n"))
    console.log("\t\tNumber of unassignable entries: " + chalk.red(entries.unassignable.length) + "\n")

    entries.employees.forEach((employee) => {
        let buildingAssignments = ""

        employee.buildings.forEach((building) => {
            buildingAssignments += building + " "
        })
        console.log(chalk.magenta("\n------------------------------------------------------------------"))
        console.log("\t\t" + chalk.black.bgCyan(employee.name.toUpperCase()) + " (" + buildingAssignments.trim() + ")")
        console.log("\t\tIN: " + chalk.green(employee.formattedTimeIn()))
        console.log("\t\tOUT: " + chalk.green(employee.formattedTimeOut()))
        console.log("\t\ttotal entries: " + chalk.green(employee.entries.length) + "\n")
        employee.entries.forEach((entry) => {
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
    })
}