"use strict"
const cheerio = require('cheerio')
const fs = require('fs')
const Entry = require('./Entry').Entry;
const Employee = require('./Employee').Employee;

//Use to extract date
// $('td.fc3').each((i, el) => {
//     console.log($(el).text())
// })

const getBuilding = (run) => {
    if(!run){
        console.log("THERE IS A NULL RUN!")
        return null
    }

    let building = run.charAt(0)
    if(building === "S"){
        return "D"
    }

    return building
}

const lengthOfTime = (filename) => {
    //TODO, figure out the length of time based on the filename/package type
    if(filename.includes("play")){
        return .5
    }

    return .25
}

const parseWalkList = (file) => {
    const allEntries = []
    const buildings = new Set()
    const totals = new Map()
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

        //TODO
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

        else if(span.hasClass('checked')){
            checkedIn = false;
        }
    })

    console.log(totals)
    return {allEntries, buildings, totals};
}

const assignEntries = (employees, entries) => {
    const unassignable = []
    let counter = 0
    let max = employees.length - 1

    function increaseCounter(){
        counter++
        if(counter > max){
            counter = 0
        }
    }

    entries.forEach((entry) => {
        let startCount = counter
        do {
            let AmTimeLeft = employees[counter].AmTimeLeft
            let PmTimeLeft = employees[counter].PmTimeLeft
            const building = getBuilding(entry.run)

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
            if(entry.timeRequest){
                if(entry.timeRequest.includes("am")){
                    if(AmTimeLeft - entry.time > 0){
                        employees[counter].entries.push(entry)

                        if(building != "O"){
                            employees[counter].buildings.add(building)
                        }

                        employees[counter].AmTimeLeft -= entry.time
                        increaseCounter()
                        return
                    }
                }
                else if(entry.timeRequest.includes("pm")){
                    if(PmTimeLeft - entry.time > 0){
                        employees[counter].entries.push(entry)

                        if(building != "O"){
                            employees[counter].buildings.add(building)
                        }

                        employees[counter].PmTimeLeft -= entry.time
                        increaseCounter()
                        return
                    }
                }
            }

            if(AmTimeLeft > PmTimeLeft){
                if(AmTimeLeft - entry.time > 0){
                    employees[counter].entries.push(entry)

                    if(building != "O"){
                        employees[counter].buildings.add(building)
                    }

                    employees[counter].AmTimeLeft -= entry.time
                    increaseCounter()
                    return
                }
            }
            else{
                if(PmTimeLeft - entry.time > 0){
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

const assignBuilding = (employees, walkInfo) => {
    const availableBuildings = Array.from(walkInfo.buildings);
    const buildingTotals = walkInfo.totals;
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
    unassignable
    return {employees, unassignable}
}

let employees = []
let allEntries = []

//Adding interface to do this later
employees.push(new Employee("Ben", 9, 12))
employees.push(new Employee("Sarah", 12.5, 14.5))
employees.push(new Employee("John", 15, 18))

//TODO Add a loop here for each walkList in the schedules folder
let walkInfo = parseWalkList('schedules/afternoonwalk3e.html')
allEntries = allEntries.concat(walkInfo.allEntries)

// console.log("Total Entries " + allEntries.length)
let buildingInfo = assignBuilding(employees, walkInfo)
// console.log(buildingInfo)
if(buildingInfo.unassignable.length > 0){
    buildingInfo.unassignable.forEach((building) => {
        console.log("Building " + building + " is unassignable")
    })
}
else{
    employees = buildingInfo.employees;
    console.log(allEntries)
    const entries = assignEntries(employees, allEntries)
    
    entries.employees.forEach((employee) => {
        // console.log("NEW EMPLOYEE: " + employee.name)
        // console.log(employee.entries.length)
        // console.log(employee.buildings)
        // console.log(employee.entries)
    })
}
