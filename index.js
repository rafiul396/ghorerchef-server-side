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
        const orderCollection = db.collection("orders")
        const requestCollection = db.collection("requests")

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

        //get meal
        app.get("/meals/:id", async (req, res) => {
            try {
                const id = req.params.id;

                const meal = await mealsCollection.findOne({
                    _id: new ObjectId(id),
                });

                if (!meal) {
                    return res.status(404).send({ message: "Meal not found" });
                }

                res.send(meal);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to fetch meal details" });
            }
        });

        //get orders
        app.get("/orders", async (req, res) => {
            try {
                const email = req.query.email;

                if (!email) {
                    return res.status(400).send({ message: "Email query is required" });
                }

                const orders = await orderCollection
                    .find({ userEmail: email })
                    .sort({ orderTime: -1 }) // latest first (optional)
                    .toArray();

                res.send(orders);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to fetch orders" });
            }
        });

        //get requests
        app.get("/requests", async (req, res) => {
            try {
                const result = await requestCollection
                    .find()
                    .sort({ requestTime: -1 }) // 🔥 latest first
                    .toArray();

                res.send(result);
            } catch (error) {
                res.status(500).send({ message: "Failed to fetch requests" });
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

        //post order
        app.post("/orders", async (req, res) => {
            try {
                const meals = req.body;
                const totalPrice = Number(meals.foodPrice) * Number(meals.quantity);
                meals.price = totalPrice

                const result = await orderCollection.insertOne(meals);

                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ message: "Failed to place order" });
            }
        });


        //chef can post her meals
        app.post("/meals", async (req, res) => {
            const meals = req.body;
            meals.createdAt = new Date();
            const result = await mealsCollection.insertOne(meals);
            res.send(result);
        })

        //post requests
        app.post("/requests", async (req, res) => {
            try {
                const { userEmail, requestType } = req.body;

                // check existing pending request
                const existingRequest = await requestCollection.findOne({
                    userEmail,
                    requestType,
                    requestStatus: "pending",
                });

                if (existingRequest) {
                    return res.status(400).send({
                        message: "You already have a pending request",
                    });
                }

                const request = {
                    ...req.body,
                    requestStatus: "pending",
                    requestTime: new Date(),
                };

                const result = await requestCollection.insertOne(request);

                res.send({
                    success: true,
                    message: "Request submitted successfully",
                    result,
                });
            } catch (err) {
                res.status(500).send({ message: "Request failed" });
            }
        });

        // app.post("/requests", async (req, res) => {
        //     try {
        //         const { userEmail, requestType } = req.body;

        //         const existing = await requestCollection.findOne({
        //             userEmail,
        //             requestStatus: "pending",
        //         });

        //         if (existing) {
        //             return res.status(400).send({
        //                 message: "Request already pending",
        //             });
        //         }

        //         const request = {
        //             ...req.body,
        //             requestStatus: "pending",
        //             requestTime: new Date(),
        //         };

        //         const result = await requestCollection.insertOne(request);
        //         res.send(result);
        //     } catch (err) {
        //         res.status(500).send({ message: "Request failed" });
        //     }
        // });




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

        //updated user role by admin
        //request reject
        app.patch("/requests/accept/:id", async (req, res) => {
            const { id } = req.params;
            const request = await requestCollection.findOne({ _id: new ObjectId(id) });

            if (!request) {
                return res.status(404).send({ message: "Request not found" });
            }

            // role update
            if (request.requestType === "chef") {
                const chefId = "chef-" + Math.floor(1000 + Math.random() * 9000);

                await userCollection.updateOne(
                    { userEmail: request.userEmail },
                    {
                        $set: {
                            userRole: "chef",
                            chefId: chefId,
                        },
                    }
                );
            }

            if (request.requestType === "admin") {
                await userCollection.updateOne(
                    { userEmail: request.userEmail },
                    { $set: { userRole: "admin" } }
                );
            }

            // request status update
            await requestCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { requestStatus: "approved" } }
            );

            res.send({ success: true });
        });

        //change user status active to fraud
        app.patch("/users/fraud/:id", async (req, res) => {
            try {
                const { id } = req.params;

                const result = await userCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $set: { userStatus: "fraud" }
                    }
                );

                res.send({ success: true });
            } catch (error) {
                res.status(500).send({ message: "Failed to mark user as fraud" });
            }
        });


        //request reject
        app.patch("/requests/reject/:id", async (req, res) => {
            const { id } = req.params;

            await requestCollection.updateOne(
                { _id: new ObjectId(id) },
                { $set: { requestStatus: "rejected" } }
            );

            res.send({ success: true });
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