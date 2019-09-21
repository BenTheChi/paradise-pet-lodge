"use strict"
const {google} = require('googleapis');
const readline = require('readline');
const fs = require('fs');

module.exports.generateSchedules = async function generateSchedules(entries){
    const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
    const TOKEN_PATH = 'token.json';
    const unassignable = entries.unassignable;
    const employees = entries.employees;

    fs.readFile('credentials.json', (err, content) => {
        if (err) return console.log('Error loading client secret file:', err);
    
        // Authorize a client with credentials, then call the Google Sheets API.
        authorize(JSON.parse(content), writeToSheets);
    });

    async function writeToSheets(client){
        const gsapi = google.sheets({version: 'v4', auth: client});
        let data = await gsapi.spreadsheets.create({
            resource: {properties: { title: "Date Title Here"}}
        })
    
        console.log(data)

        // entries.employees.forEach((employee) => {
        //     let buildingAssignments = ""
    
        //     employee.buildings.forEach((building) => {
        //         buildingAssignments += building + " "
        //     })
            
        //     employee.entries.forEach((entry) => {
        //         console.log(entry.run + entry.name + entry.sex + entry.age + entry.breed)
        //         if(entry.timeRequest){
        //             console.log(entry.timeRequest)
        //         }
        //         if(entry.request){
        //             console.log(entry.request)
        //         }
        //         if(entry.out){
        //             console.log(entry.out)
        //         }
        //         if(entry.special){
        //             console.log(entry.special)
        //         }
        //         console.log("")
        //     })
        // })
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

async function writeStuff(cl){
    const gsapi = google.sheets({version: 'v4', auth: cl});

    const opt = {
        spreadsheetId: '1cd9tgF-N-hjT10OQQ8Ni2VIliCC9lc4Fk39e90OjFpo',
        range: 'A1:B4'
    };

    const updateOptions = {
        spreadsheetId: '1cd9tgF-N-hjT10OQQ8Ni2VIliCC9lc4Fk39e90OjFpo',
        range: 'A6',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [['Gir', 23, "Something message here", false], ['Gir', null, "Something message here", true]] }
    }
    const updateOptions2 = {
        spreadsheetId: '1cd9tgF-N-hjT10OQQ8Ni2VIliCC9lc4Fk39e90OjFpo',
        range: 'A6',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [['Gir', 23, "Something message here", false], ['Gir', null, "Something message here", true]] }
    }

    let data = await gsapi.spreadsheets.values.update(updateOptions);
    let data = await gsapi.spreadsheets.values.update(updateOptions);

    console.log(data.status);
}