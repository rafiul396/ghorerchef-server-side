require('dotenv').config()
const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000

app.use(express.json())
app.use(cors())

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.MONGODB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
})
async function run() {
    try {

        // Create Database and Collection
        const db = client.db('ghorerChefDB');
        const userCollection = db.collection("users")
        const mealsCollection = db.collection("meals")

        //get all user data for admin
        app.get("/users", async (req, res) => {
            const cursor = userCollection.find();
            const result = await cursor.toArray();
            res.send(result);
        });

        //get single users data
        app.get("/users/:email", async (req, res) => {
            const email = req.params.email;

            const query = { userEmail: email }

            const result = await userCollection.findOne(query);
            res.send(result);
        });

        //get meals
        app.get("/meals", async (req, res) => {
            try {
                const email = req.query.email;

                const query = {};
                if (email) {
                    query.userEmail = email;
                }

                const result = await mealsCollection.find(query).toArray();
                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch meals" });
            }
        });


        //Post users data
        app.post("/users", async (req, res) => {
            const users = req.body;
            users.userRole = "user"
            users.userStatus = "active"
            users.createdAt = new Date()
            const result = await userCollection.insertOne(users)
            res.send(result)
        })

        //chef can post her meals
        app.post("/meals", async (req, res) => {
            const meals = req.body;
            meals.createdAt = new Date();
            const result = await mealsCollection.insertOne(meals);
            res.send(result);
        })

        //updated meals data by chef
        app.put("/meals/:id", async (req, res) => {
            const id = req.params.id;
            const updatedData = req.body;

            const result = await mealsCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: updatedData }
            );

            res.send({ success: true, result });
        });


        //delete meals by chef
        app.delete("/meals/:id", async (req, res) => {
            try {
                const id = req.params.id;

                const query = { _id: new ObjectId(id) };

                const result = await mealsCollection.deleteOne(query);

                if (result.deletedCount === 0) {
                    return res.status(404).send({ message: "Meal not found" });
                }

                res.send({
                    success: true,
                    message: "Meal deleted successfully",
                });
            } catch (error) {
                console.error(error);
                res.status(500).send({
                    success: false,
                    message: "Failed to delete meal",
                });
            }
        });

        // Get all plants by fetching this API

        // Get single plant to fatche this API

        // Setup payment getway system using stripe

        // Send a ping to confirm a successful connection
        await client.db('admin').command({ ping: 1 })
        console.log(
            'Pinged your deployment. You successfully connected to MongoDB!'
        )
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir)

app.get("/", async (req, res) => {
    res.send("Hello Chef")
})

app.listen(port, () => {
    console.log(`Running port is ${port}`);

})