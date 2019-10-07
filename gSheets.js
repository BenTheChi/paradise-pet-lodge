"use strict"
const {google} = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';

module.exports.generateSchedules = async function generateSchedules(title, employees, unassignable){

    let total = unassignable.length
    console.log("Unassigned: " + total);
    employees.forEach((employee) => {
        total += employee.entries.length
    })
    console.log("All Sheet Entries Total: " + total);

    fs.readFile('credentials.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
    
        // Authorize a client with credentials, then call the Google Sheets API.
        authorize(JSON.parse(content), generateSpreadsheet);
    });

    async function createSheets(gsapi){
        let resource = {properties: { title }};
        let sheets = [];
        
        sheets.push({
            properties: {
                title: "Employees",
                sheetType: 'GRID'
            }
        })

        sheets.push({
            properties: {
                title: "Unassignable",
                sheetType: 'GRID'
            }
        })

        employees.forEach((employee) => {
            let sheet = {
                properties: {
                    title: employee.name,
                    sheetType: 'GRID'
                }
            };

            sheets.push(sheet);
        })
    
        resource.sheets = sheets;

        let spreadsheet = await gsapi.spreadsheets.create({resource})

        return spreadsheet;
    }

    //Creates a multi dimensional array representing the entries
    function createSheetArray(entries){
        let finalArray = [['TYPE', 'RUN', 'PET NAME', 'BREED', 'AGE', 'SEX', 'OUT TIME', 'LENGTH', 'REQUEST', 'INITIALS', 'TIME']]
        entries.forEach((entry) => {
            finalArray.push([entry.title, entry.run, entry.name, entry.breed, entry.age, entry.sex, entry.timeRequest, entry.time*60+" min", entry.request, "", ""])
        })

        return finalArray
    }

    function createEmployeeArray(employees){
        let finalArray = [['NAME', 'BUILDINGS', 'TIME IN', 'TIME OUT', 'AM USED', 'NOON USED', 'PM USED', 'TOTAL USED']]
        employees.forEach((employee) => {
            let usedAm = ""
            let usedNoon = ""
            let usedPm = ""
            let usedTotal = ""

            if(employee.totalAm != 0){
                usedAm = Math.floor(100 - employee.AmTimeLeft/employee.totalAm*100) + "%"
            }
            if(employee.totalNoon != 0){
                usedNoon = Math.floor(100 - employee.NoonTimeLeft/employee.totalNoon*100) + "%"
            }
            if(employee.totalPm != 0){
                usedPm = Math.floor(100 - employee.PmTimeLeft/employee.totalPm*100) + "%"
            }
            if(employee.usedTotal != 0){
                usedTotal = Math.floor(employee.getPercentageTimeUsed()) + "%"
            }
            
            //TODO Check to see how to add formulas
            finalArray.push([employee.name, Array.from(employee.buildings).join(', '), employee.formattedTimeIn(), employee.formattedTimeOut(), usedAm, usedNoon, usedPm, usedTotal])
        })
        return finalArray;
    }

    async function writeToSheets(gsapi, sheets, spreadsheetId){
        try{
            //Write to sheet for each employee
            let promises = employees.map(async (employee) => {
                const entries = employee.entries;
                const range = `'${employee.name}'!A1`
                
                await gsapi.spreadsheets.values.update({
                    spreadsheetId, 
                    range,
                    valueInputOption: 'USER_ENTERED',
                    resource: {
                        range,
                        values: createSheetArray(entries)
                    }
                })
            })

            //Create the employee info sheet
            promises.push(await gsapi.spreadsheets.values.update({
                spreadsheetId, 
                range: `'Employees'!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    range: `'Employees'!A1`,
                    values: createEmployeeArray(employees)
                }
            }))

            //Create the unassignable employee sheet
            promises.push(await gsapi.spreadsheets.values.update({  
                spreadsheetId,
                range: `'Unassignable'!A1`,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    range: `'Unassignable'!A1`,
                    values: createSheetArray(unassignable)
                }
            }))

            await Promise.all(promises);

            promises = sheets.map(async (sheet) => {
                let requests = [
                    {
                        repeatCell: {
                          range: {
                            sheetId: sheet.properties.sheetId,
                            startRowIndex: 0,
                            endRowIndex: 1
                          },
                          cell: {
                            userEnteredFormat: {
                              horizontalAlignment: "CENTER",
                              textFormat: {
                                foregroundColor: {
                                  red: 0.0,
                                  green: 0.0,
                                  blue: 0.0
                                },
                                bold: true,
                              }
                            }
                          },
                          fields: 'userEnteredFormat(horizontalAlignment,backgroundColor,textFormat)'
                        }
                    },
                    {
                        repeatCell: {
                            range: {
                              sheetId: sheet.properties.sheetId,
                              startRowIndex: 0,
                              startColumnIndex: 0
                            },
                            cell: {
                              userEnteredFormat: {
                                wrapStrategy: "WRAP",
                              }
                            },
                            fields: 'userEnteredFormat(wrapStrategy)'
                          }
                    }
                ]

                if(sheet.properties.title === "Employees"){
                    requests.push({
                        repeatCell: {
                          range: {
                            sheetId: sheet.properties.sheetId,
                            startRowIndex: 1,
                            endRowIndex: 100,
                            startColumnIndex: 2,
                            endColumnIndex: 4
                          },
                          cell: {
                            userEnteredFormat: {
                              numberFormat: {
                                type: "TIME",
                                pattern: `hh:mm AM/PM`
                              }
                            }
                          },
                          fields: 'userEnteredFormat(numberFormat)'
                        }
                    })
                }
                else{
                    requests.push({
                        repeatCell: {
                            range: {
                              sheetId: sheet.properties.sheetId,
                              startRowIndex: 1,
                              startColumnIndex: 6,
                              endColumnIndex: 7
                            },
                            cell: {
                              userEnteredFormat: {
                                numberFormat: {
                                  type: "TIME",
                                  pattern: `hh:mm AM/PM`
                                }
                              }
                            },
                            fields: 'userEnteredFormat(numberFormat)'
                          }
                    })
                }

                await gsapi.spreadsheets.batchUpdate({
                    spreadsheetId, 
                    resource: {
                        requests
                    }
                })
            })

            await Promise.all(promises);
        }
        catch(error){
            console.log(error)
        }
    }

    async function generateSpreadsheet (client){
        const gsapi = google.sheets({version: 'v4', auth: client});

        const spreadsheet = await createSheets(gsapi);

        if(spreadsheet.data){
            const data = await writeToSheets(gsapi, spreadsheet.data.sheets, spreadsheet.data.spreadsheetId);
        }
        else{
            console.log("Error creating spreadsheet")
            return
        }
    }
}


function authorize(credentials, callback) {
    const {client_secret, client_id, redirect_uris} = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(
        client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, (err, token) => {
        if (err) return getNewToken(oAuth2Client, callback);
        oAuth2Client.setCredentials(JSON.parse(token));
        callback(oAuth2Client);
    });
}

function getNewToken(oAuth2Client, callback) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
        rl.close();
        oAuth2Client.getToken(code, (err, token) => {
        if (err) return console.error('Error while trying to retrieve access token', err);
        oAuth2Client.setCredentials(token);
        // Store the token to disk for later program executions
        fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
            if (err) return console.error(err);
            console.log('Token stored to', TOKEN_PATH);
        });
        callback(oAuth2Client);
        });
    });
}