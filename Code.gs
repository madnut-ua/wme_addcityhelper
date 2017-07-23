function sendEmail(row) {

  function setCell(sheet,c,s){
    // ���������� �������� ������ C ������� ������ � S � ����������� � �����������.
    var currRow = (row ? row : sheet.getActiveCell().getRow());
    //sheet.getRange(c + currRow).setValue(sheet.getRange(c + currRow).getValue() + "\r\n" + s);
    sheet.getRange(c + currRow).setValue(s);
  };

  function getShortDate(date) {
    // �������� �������� ���� DD.MM.YYYY
    var dd = date.getDate();
    var mm = date.getMonth() + 1;  
    var yyyy = date.getFullYear();
    var HH = date.getHours();
    var MM = date.getMinutes();
    var SS = date.getSeconds();
    
    if (dd<10) {dd='0'+dd}; 
    if (mm<10) {mm='0'+mm};
    if (HH<10) {HH='0'+HH};
    if (MM<10) {MM='0'+MM};
    if (SS<10) {SS='0'+SS};
    
    date = dd + '.' + mm + '.' +yyyy+' '+HH+':'+MM+':'+SS;
    
    return date;
  };

  
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var currRow = (row ? row : sheet.getActiveCell().getRow());
  
  var isSendYet = sheet.getRange("Q" + currRow).getValue();
  
  if (isSendYet) { 
    Browser.msgBox("������ ��� ���� ���������� �����! ��� ��������� �������� �������� ������ � ������� P");
    return;
  }
  
  var dtOrig = sheet.getRange("A" + currRow).getValue();
  var fio = sheet.getRange("B" + currRow).getValue();
  var address = sheet.getRange("C" + currRow).getValue();
  var permalinkValues = sheet.getRange("D" + currRow).getValue();
  var NameCity = sheet.getRange("E" + currRow).getValue();
  var NameState = sheet.getRange("F" + currRow).getValue();
  var NameRegion = sheet.getRange("G" + currRow).getValue();
  
    
  var Result = sheet.getRange("M" + currRow).getValue();
  var FinalMes = sheet.getRange("O" + currRow).getValue();
  var NickSolver = sheet.getRange("N" + currRow).getValue();
      
  if (!Result || !FinalMes || !FinalMes || !NickSolver)  { 
    Browser.msgBox("������ �� ����� ���� ����������. ��������� ������� �, N � O!");
    return { "result" : "error sending email - empty cells"};
  }
  
  
  var curDateStamp=new Date;
  
  var subject = "[WME City Lock] ������ ��������� ";
  var message="<p>������������, " + fio + "!" + "</br></p>";
  
  if (Result == "��" || Result == "yes"){
      subject +="������������.";
      message += "<p><p>��� ������ �� "+getShortDate(dtOrig)+" �� ���������� ����������� ������ �<b>"+NameCity+"</b>� <font color=#007700><b>��������</b></font> "+getShortDate(curDateStamp)+".</p>"+
               "<p>� ������� "+permalinkValues+" ������ ���������� �����: �<b>"+FinalMes+"</b>�.</p>";
  }
  else {
      subject +="������������.";
      message += "<p><p>��� ������ �� "+getShortDate(dtOrig)+" �� ���������� ����������� ������ �<b>"+NameCity+"</b>� � ������� "+permalinkValues+" <font color=red><b>�� ��������</b></font>.</p>"+
               "<p>�������: �<em>"+FinalMes+"</em>�.</p>";
  }   

  //message += "<p><p>-- <p><em>"+NickSolver+"</em></p><p><img src='cid:wazeLogoUrl'></p>";
  //message += "<p><p>-- <p><em>"+NickSolver+"</em></p>";
  
    //var wazeLogoUrl = "https://lh4.googleusercontent.com/9Ye-RfNGKz7ArTgV4yfZPojd5PIzNEMWc2kyqgBmof7I7Itmo0SIOGGhm5reN_KfNvv-XA=s190";
    var PostScriptum = "<font color=#007500><b>���� �� ��� �� �������������� � ����������� ���������� ����������, �� � ��� ���� ������� ���������� �������� ����� Waze, �������������� � ���������� ����������� �������, ��������� ���������� ��� �����: http://goo.gl/forms/aUYIThl5gg. ����� ���� ��� ������! )))</b></font>";

    message += "<p><p>-- <p><em>"+NickSolver+"</em></p>"+PostScriptum;
    var wazeLogoUrl = "https://dl.dropboxusercontent.com/s/h4o31nbqjsmoth9/waze_ua.png";
    var wazeLogoBlob = UrlFetchApp
                          .fetch(wazeLogoUrl)
                          .getBlob()
                          .setName("wazeLogoUrl");

    MailApp.sendEmail({
      to: address,
      subject: subject,
      htmlBody: message,
      inlineImages:
       {
         wazeLogoUrl: wazeLogoBlob
       }
   });
    
  
  // ������ ������� ��������
  setCell(sheet,"Q",getShortDate(curDateStamp));
  // ������ "������� �������"
  setCell(sheet,"R",Math.round((curDateStamp.getTime()-dtOrig.getTime())/(3600*24)));

  setCityID(currRow);
  
  //Browser.msgBox("������ ������� ����������!");
  return { "result" : "success" };
}

function setCityID(row) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var currRow = (row ? row : sheet.getActiveCell().getRow());
  
  cN="O"
  cV="M"
  if(sheet.getSheetName() == "����� (�� 13.04.2015)") 
  {
    cN="L"
    cV="K"
  }

  var cityName = sheet.getRange(cN + currRow).getValue();
  
  //(cityName.indexOf(".") > 0)
  //cityName=cityName.substring(0,cityName.indexOf("."))
//sheet.getRange("J" + 1592).setValue(cityName);
    if(cityName && sheet.getRange(cV + currRow).getValue().trim() == "��")
    {
      var id=getcityID(cityName)
      if(id)
      {
        sheet.getRange("P" + currRow).setValue(id)
        sheet.getRange("S" + currRow).setValue(cityName)
      }
    }
  
}