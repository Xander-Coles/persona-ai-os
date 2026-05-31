// Job Tracker Webhook — paste this into Google Apps Script (Extensions → Apps Script)
// After pasting: Project Settings → Script Properties → add WEBHOOK_SECRET = <your secret>
// Then: Deploy → New deployment → Web app → Execute as: Me → Who has access: Anyone → Deploy
// After any update to this file, create a NEW deployment to pick up changes.

function doGet(e) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    if (e.parameter.secret !== secret) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Job Apps');
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Sheet "Job Apps" not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var values = sheet.getDataRange().getValues();
    return ContentService
      .createTextOutput(JSON.stringify({ rows: values }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
    var data = JSON.parse(e.postData.contents);

    if (data.secret !== secret) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Job Apps');
    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify({ error: 'Sheet "Job Apps" not found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (data.action === 'update') {
      // Update a specific cell range: data.range = "I5", data.values = [["Rejected"]]
      var range = sheet.getRange(data.range);
      range.setValues(data.values);
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, updated: data.range }))
        .setMimeType(ContentService.MimeType.JSON);
    } else {
      // Default action: append new rows
      var rows = data.rows;
      rows.forEach(function(row) {
        sheet.appendRow(row);
      });
      return ContentService
        .createTextOutput(JSON.stringify({ success: true, appended: rows.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
