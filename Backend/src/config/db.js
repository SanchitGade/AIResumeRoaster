import mongoose from 'mongoose';
import env from './env.js';

// .set("strictQuery, true") - > Helps to input valided, Only allow fields that exist in the schema when filtering
mongoose.set("strictQuery", true);

async function connectDB() {
    const connection = await mongoose.connect(env.mongoUri, {
        serverSelectionTimeoutMS: 10_000,
        //If DB doesnt connect in 10sec - Connection Failed, Stop form hanging forever  
    });
    console.log(`MongoDB Connected: ${connection.connection.host} / ${connection.connection.host}`);

    mongoose.connection.on("error", (error) => {
        console.error("MongoDB Error : ", error.message);
    })

    mongoose.connection.on("disconnect", () => {
        console.warn("MongoDB Disconnected");
    })   
}

export default connectDB;
