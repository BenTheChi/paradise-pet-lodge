const cheerio = require('cheerio')
const fs = require('fs')
const readline = require('readline');
const {google} = require('googleapis');

let htmlData = fs.readFileSync('schedules/Afternoonwalk11.html', 'utf-8')
htmlData = htmlData.replace(/(fc3)|(fc13)/g,"target")
htmlData = htmlData.replace(/(fc8)|(fc15)/g,"out")
htmlData = htmlData.replace(/(fc6)/g,"checked")
htmlData = htmlData.replace(/(&nbsp;&nbsp;)/g," ")

const $ = cheerio.load(htmlData);
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const TOKEN_PATH = 'token.json';

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

fs.readFile('credentials.json', (err, content) => {
    if (err) return console.log('Error loading client secret file:', err);
    // Authorize a client with credentials, then call the Google Sheets API.
    authorize(JSON.parse(content), updateSheet);
});



//Use to extract date
// $('td.fc3').each((i, el) => {
//     console.log($(el).text())
// })

class Row {
    constructor(run, name, sex, age, breed, request, out, checkedIn){
        this.run = run;
        this.name = name;
        this.sex = sex;
        this.age = age;
        this.breed = breed;
        this.request = request;
        this.out = out;
        this.checkedIn = checkedIn;
    }
}

class Employee {
    constructor(name, timeIn, timeOut){
        this.name = name
        this.timeIn = timeIn
        this.timeOut = timeOut
        this.rows = []
    }
}

const allRows = []

let run, name, sex, age, breed, request, out = null;
let checkedIn = true;
let targetCount = 0;

$('div').each((i, el) => {
    const span = $(el).children().first()
    const value = span.text().trim()
    if($(el).hasClass('section') && name && breed){
        const row = new Row(run, name, sex, age, breed, request, out, checkedIn)
        allRows.push(row)

        run, name, sex, age, breed, request, out = null;
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

function updateSheet(auth){
    const sheets = google.sheets({version: 'v4', auth});
    sheets.spreadsheets.values.update({
        spreadsheetId: 'https://docs.google.com/spreadsheets/d/1xoZYR5HKT6j_cMUluaZmzpkngOGw2zauEwrePRR5swI/values/edit',
        range: 'Sheet1!A1',
        valueInputOption: 'USER_ENTERED',
        allRows
    }, (err, result) => {
        if(err){
            console.log(err)
        } else{
            console.log(result)
        }
    })
}
