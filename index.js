"use strict";
const fs = require('fs-extra');
const path = require('path');
const Entry = require('./Entry').Entry;
const Employee = require('./Employee').Employee;
const gSheets = require('./gSheets');
const chalk = require('chalk');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

let allEntries = []
let walkEntries = []
let playEntries = []
let anyTimeEntries = []
let buildings = new Set()
let totals = new Map()

//Loop through each schedule and parse it into allEntries
const directoryPath = path.join(process.cwd(),'schedules')
const files = fs.readdirSync(directoryPath)

if(!files){
    console.log(chalk.red('Unable to load from activities folder'));
    rl.setPrompt("Press 'Enter' button to close this window\n\n");
    rl.prompt();
    rl.on('line', () => rl.close());
}
else if(files.length === 0){
    console.log(chalk.red('There are no activity schedules'));
    rl.setPrompt("Press 'Enter' button to close this window\n\n");
    rl.prompt();
    rl.on('line', () => rl.close());
}
else{

    (async () => {
        let dateTitle = null;
    
        files.forEach((file) => {
            let walkInfo = parseWalkList('schedules/' + file)
            const entryTotal = walkInfo.walkEntries.length + walkInfo.playEntries.length + walkInfo.anyTimeEntries.length
            console.log(chalk.blue(file + " total entries: " + entryTotal))
            walkEntries = walkEntries.concat(walkInfo.walkEntries)
            playEntries = playEntries.concat(walkInfo.playEntries)
            anyTimeEntries = anyTimeEntries.concat(walkInfo.anyTimeEntries)
    
            buildings = new Set([...buildings, ...walkInfo.buildings])
            totals = mergeTotals(totals, walkInfo.totals)
            if(!dateTitle){
                dateTitle = walkInfo.dateTitle.trim();
            }
        })
    
        walkEntries.sort((a, b) => (a.run > b.run) ? 1 : -1);
        playEntries.sort((a, b) => (a.run > b.run) ? 1 : -1);
        anyTimeEntries.sort((a, b) => (a.run > b.run) ? 1 : -1);
        allEntries = allEntries.concat(walkEntries, playEntries, anyTimeEntries);
        
        console.log(chalk.blue("All Entries Total: " + allEntries.length));
    
        const employeeEntries = assignEmployees(allEntries, buildings, totals);
        console.log(chalk.blue("Unassigned Entries Total: " + employeeEntries.unassignable.length));
        console.log(chalk.green("Creating Google spreadsheet " + dateTitle));

        await gSheets.generateSchedules(dateTitle, employeeEntries.employees, employeeEntries.unassignable)
        console.log(chalk.green("Schedules created successfully!"))
        console.log(chalk.green("Moving employee files to archive"))
        await fs.copy('employees', `employees_archive/Employees ${dateTitle.replace("Schedule for ", "")}`)
        await fs.emptyDir('employees')
        console.log(chalk.green("Moving activity files to archive"))
        await fs.copy('schedules', `schedules_archive/Activities ${dateTitle.replace("Schedule for ", "")}`)
        await fs.emptyDir('schedules')
    })()
    .catch((error) => {
        console.log(chalk.red(error))
    })
    .finally(() => {
        rl.setPrompt("Press 'Enter' button to close this window\n\n");
        rl.prompt();
        rl.on('line', () => rl.close());
    })
}


function assignEmployees(allEntries, buildings, totals){
    let employees = parseEmployeeList('employees/Export_Schedule_Print.csv');
    let buildingInfo = assignBuilding(employees, buildings, totals);
    employees = buildingInfo.employees;

    let entries = assignEntries(employees, allEntries)
    employees = entries.employees;

    return {employees, unassignable: entries.unassignable};
}

function getBuilding(run) {
    if(!run){
        console.log(chalk.red("EMPTY RUN DETECTED!"))
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

    if(!employeeData){
        throw new Error("Cannot read employee schedules file")
    }

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

    let employeeDataArray = employeeData.split('\n');
    employeeDataArray.shift();
    
    for(let i=0; i<employeeDataArray.length; i++){
        if(i%2 === 0){
            let regex = RegExp('\\d{1,2}:\\d{1,2}(am|pm) - \\d{1,2}:\\d{1,2}(am|pm)')
            if(!regex.test(employeeDataArray[i])){
                throw new Error("Invalid employee time entry #" + (i + 1))
            }

            let times = employeeDataArray[i].split(' - ');
            employeeTimeIn = timeToNum(times[0]);
            employeeTimeOut = timeToNum(times[1]);
            continue;
        }

        //Only take the name.  Ignore total time.
        employeeName = employeeDataArray[i].split(',')[1];
        if(!employeeName){
            throw new Error("Employee name entries cannot be blank")
        }

        employees.push(new Employee(employeeName, employeeTimeIn, employeeTimeOut));

        //Reset employee entry
        employeeName = "";
        employeeTimeIn = 0;
        employeeTimeOut = 0;
    }

    if(!employees.length === 0){
        throw new Error("There are no employee schedules")
    }

    employees.sort((a, b) => (a.totalTime < b.totalTime) ? 1 : -1);

    return employees
}

function parseWalkList(file){
    let walkEntries = []
    let playEntries = []
    let anyTimeEntries = []
    const buildings = new Set()
    const totals = new Map()
    let walkData = fs.readFileSync(file, 'utf-8');
    walkData = walkData.trim().replace(/"/g,"").replace(/,Schedule/g,"");
    function getTimeRequest(request){
        request = request.toLowerCase()

        if(!request){
            return null
        }

        request = request + " "
        const timeRequest = request.match(/((1[0-2])|[1-9])?(pm |am |noon )/g)
        
        if(timeRequest){
            for(let i=0; i<timeRequest.length; i++){
                timeRequest[i] = timeRequest[i].trim()
            }
        }

        return timeRequest
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
        const title = rowArray[9];
        const run = rowArray[14];
        const name = rowArray[16];
        const sex = rowArray[20];
        const age = rowArray[22];
        const breed = rowArray[24];
        const request = rowArray[32];
        const out = rowArray[27];
        const timeRequest = getTimeRequest(request);
        const special = "";

        if(title.includes("Play") || title.includes("Ply")){
            time = .5;
        }

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
            //Skip over Evening Pkg Play and double on the others
            if(title.includes("Evening Pkg Play")){
                return
            }
            if(timeRequest){
                timeRequest.forEach((timeRequestEntry) => {
                    const entry = new Entry(title, run, name, sex, age, breed, request, out, special, timeRequestEntry.toLowerCase(), time)

                    if(time === .25){
                        walkEntries.push(entry)
                    }
                    else{
                        playEntries.push(entry)
                    }
                })
            }
            else{
                const entry = new Entry(title, run, name, sex, age, breed, request, out, special, timeRequest, time)
                anyTimeEntries.push(entry)
            }
        } catch (error) {
            console.log(error)
        }
    })

    return {walkEntries, playEntries, anyTimeEntries, buildings, totals, dateTitle};
}

function assignEntries(employees, entries){
    const unassignable = [];
    let counter = 0;
    let max = employees.length - 1;
    
    function increaseCounter(){
        counter++
        if(counter > max){
            counter = 0
        }
    }

    function decreaseCounter(){
        counter--
        if(counter < 0){
            counter = max
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

        return null
    }

    function sameRunExists(employee, {run, title, timeRequest}){
        for(let i=employee.entries.length-1; i>=0; i--){
            const entry = employee.entries[i];

            if(entry.run === run && entry.title === title && entry.timeRequest === timeRequest){
                return true;
            }
        }
        return false;
    }

    entries.forEach((entry, index) => {    
        let startCount = counter
        do {
            let type = null
            let decimalTime = convertToDecimalTime(entry.timeRequest)
            let AmTimeLeft = employees[counter].AmTimeLeft
            let PmTimeLeft = employees[counter].PmTimeLeft
            let NoonTimeLeft = employees[counter].NoonTimeLeft

            const building = getBuilding(entry.run)
            if(!building){
                break
            }

            let prevCounter = counter - 1;
            if(prevCounter < 0){
                prevCounter = max;
            }

            if(sameRunExists(employees[prevCounter], entry)){
                if(!entry.request.toLowerCase().includes("alone")){
                    entry.time = 0;  //Do not include duplicate entry times
                    employees[prevCounter].entries.push(entry)
                    return
                }

                increaseCounter()
                continue
            }

            if(AmTimeLeft <= 0 && PmTimeLeft <= 0 && NoonTimeLeft <= 0){
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
            else if(entry.timeRequest.toLowerCase().includes("am")){
                type = "am";
            }
            else if(entry.timeRequest.toLowerCase().includes("pm")){
                type = "pm";
            }
            else if(entry.timeRequest.toLowerCase().includes("noon")){
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

    if(unassignable.length > 0){
        buildingInfo.unassignable.forEach((building) => {
            console.log("Building " + building + " is unassignable")
        })
    }

    return {employees, unassignable}
}