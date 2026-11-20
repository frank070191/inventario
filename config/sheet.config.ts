import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

const EMAIL = "inventario-app@indigo-replica-515112-n8.iam.gserviceaccount.com";
const SHEET_ID = "1gpWCKZuaadU4l2u5xU8LWOcTy-4OY9MVH-_lmz59eEk";

// Pega tu clave completa entre las tildes invertidas ( ` )
// Puedes pegar los saltos de línea tal cual, sin miedo.
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCvJkD+ysxbWtKc\ncyb6pwCij/13N9s4I2zy3PLdAdmySjyxwsXWPZsRjEdWsljORL4e6G72AX42yKS6\nc3v0++tOgWMmB82mAfYfxwoDf9QE9luCReKC/PUtfjtcqItHh1UrFleEu6DZYgb3\nuLp6Zw5++1ByeC+jZ4Ng7phmBYUwbVTKJg58rgDKEGMWGOf2CiYZ6DCQX2WQMviw\n0pH76/t79M3deq1c+xQDHeK41fK0NLqArrTzKBgrEpUsLSORjjnM+PK436tIRryA\nUtudIlwEnXk8xQkEDAML0kKaPHT58QSmdPTKgXnIQqnfVbf6bU+rIiAyz6cISdvL\nGwBtBTVLAgMBAAECggEAE9SE71QOpxk1VzlCZIab78vVqrXMQCLipuyVIqie+Sym\niom+1G7NK8NyIEK5A0GNNPqj9X5dx94XqHSCyE3takoD675ebjkyoI5sd9D1NEqg\nObOn3aS+LZRpLCh4/HQ6FFLHPePwZixPFaT4l/srDP1vMkahPiLuIP9iicp+Nek6\n+/+3svqz0auJ4fNXxhUapA+QeqP+YKZZjTCCNR4of8aQ7qYjkU55GcwIVBPN5JD3\nWeH3OIMwzwgwPQNrBjfcMVNE9dMSG10DeARj20BHsXGuZCcKH0u7Y0xIlZIJ9J1r\nfBDzZbb2GmqgAPXbiikAWfm5cuWKuNCNg9/ubMdCQQKBgQDd5IV4WT0DL6U3HT7A\nKyeR8nUrSTYZnlRGdk23Xlpag7vfOJQwqYVwuqNJ/Suu3Wv1wBJASqL3y/SiYhCP\n/qX4nH/ktcquANWuabGwjCmJ0qeDgeLlkdHw4SmpyBAsB1dLJ2xcOr8l3lVyfGU6\nnAB5D0Zsch8KIOca6pfYPl45owKBgQDKEmLFPkUCJP+LAaRpbxTJqPXUwxLnl7ov\n1FLqtL28FwejzaTbqviFmkboxbwjQccdh5HKjNXzuBiXY3KNcfZi0l8rOz/F/jDs\nPdP1ZQM1OTpHOlnZQbkU0nwGeKetmZvKjsBMtGMcQARRWIZYqKdEFRfkcnnE2BeZ\nHd/0izIgOQKBgQDTXOnSgNbAYTM0c7QhYzoXKOh5agyRjKLkV66h28ufatqbwA5Q\n6DnG7tG6GeHxeNNszR/VhAMGnY4S2+zA7SV10sV0u8Iry3m/4Mg0zt6GfVW5zBCw\n8x0TIbgJFRxqhDefzBbJJ+CKluW330yh7pX4uxcvF+n/QOZDWnF3t7kTlwKBgQCu\nI9YWoSkbRgMrKgkkC2RgvUjNSCdcifccDOA//+6az0X4NdpirB5sFJ4TL4SI5cDQ\ng+pyIZin5fjbTgqENrfcRetZ+D9nQz2p+UZWbeyry1ub0n9nqSn09ceIVCY8huop\nT4gNEk9vIwQVjjKI6R7snzjt2HFz373GaGZ9+g8CkQKBgGYfqYWU5SfRhC7U4R2S\n6vhy8WDm8kuZQxNP+x8qwQ9SzY78UsoJ3GnGUImHK6ZndICPJSZWk3M67ldHglFy\n9JX+ZjVT9ic3HEIDuGEUW4vCSM1Iembj5NLNUgrwwfn6uPJzmlG1ETMkxbvIBRc0\nyRAzYlhDyXFp2urOWHJVKmMe\n-----END PRIVATE KEY-----\n`;

const serviceAccountAuth = new JWT({
  email: EMAIL,
  key: PRIVATE_KEY,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

let doc: any = null;

export async function initGoogleSheets(): Promise<any> {
  if (!doc) {
    doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    console.log('✅ Google Spreadsheet inicializado correctamente');
  }
  return doc;
}

export async function getSheet(sheetTitle: string): Promise<any> {
  const spreadsheet = await initGoogleSheets();
  let sheet = spreadsheet.sheetsByTitle[sheetTitle];
  if (!sheet) {
    throw new Error(`La hoja "${sheetTitle}" no existe.`);
  }
  return sheet;
}

export { serviceAccountAuth };