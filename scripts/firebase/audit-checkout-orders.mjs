import { cert, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const orderIds = process.argv.slice(2);

if (orderIds.length === 0) {
  throw new Error("Provide at least one order document ID.");
}

const app = initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});
const db = getFirestore(app);

const results = await Promise.all(
  orderIds.map(async (id) => {
    const snapshot = await db.collection("orders").doc(id).get();
    const data = snapshot.data() ?? {};

    return {
      id,
      exists: snapshot.exists,
      status: data.status ?? null,
      paymentStatus: data.paymentStatus ?? null,
      confirmationEmailId: data.confirmationEmailId ?? null,
      confirmationEmailMarked: Boolean(data.confirmationEmailSentAt),
    };
  }),
);

console.log(JSON.stringify(results, null, 2));
