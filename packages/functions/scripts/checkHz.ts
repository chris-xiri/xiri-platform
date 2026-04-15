import * as admin from 'firebase-admin';
const serviceAccount = require('../../../service-account.json');
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
admin.firestore().collection('contacts').doc('hswchszwehPVRg44SGSc').get().then((doc: any) => console.log(doc.data()));
