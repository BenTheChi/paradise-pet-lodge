"use strict"
const {google} = require('googleapis');
const readline = require('readline');
const fs = require('fs');
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';

module.exports.generateSchedules = async function generateSchedules(title, employees, unassignable){
    fs.readFile('credentials.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
    
        // Authorize a client with credentials, then call the Google Sheets API.
        authorize(JSON.parse(content), generateSpreadsheet);
    });

    async function createSheets(gsapi){
        let resource = {properties: { title }};
        let sheets = [];
        
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
        let finalArray = [['RUN', 'PET NAME', 'BREED', 'AGE', 'SEX', 'TIME', 'REQUEST']]
        entries.forEach((entry) => {
            finalArray.push([entry.run, entry.name, entry.breed, entry.age, entry.sex, entry.timeRequest, entry.request])
        })

        return finalArray
    }

    async function writeToSheets(gsapi, spreadsheetId){
        try{
            //Write to sheet for each employee
            //TODO Do this as a batchUpdate.  Make header bolded.
            const promises = employees.map(async (employee) => {
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

            return await Promise.all(promises);
        }
        catch(error){
            console.log(error)
        }
    }

    async function generateSpreadsheet (client){
        const gsapi = google.sheets({version: 'v4', auth: client});

        const spreadsheet = await createSheets(gsapi);
        // let spreadsheet = await gsapi.spreadsheets.create({
        //     resource: createSheets()
        // })

        console.log(spreadsheet.data.sheets)

        if(spreadsheet.data){
            const data = await writeToSheets(gsapi, spreadsheet.data.spreadsheetId);
            console.log(data);
        }
        else{
            console.log("Error creating spreadsheet")
            return
        }
    
        // console.log(spreadsheet.data.sheets)
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