import express from "express";
import Stripe from "stripe";
import cors from "cors";
import fs from "fs";

const app = express();

// 🔐 Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ⚠️ webhook raw body
app.use("/webhook", express.raw({ type: "application/json" }));

app.use(cors());
app.use(express.json());

// 📁 orders file
const ORDERS_FILE = "./orders.json";

// 💾 save order
const saveOrder = (order) => {
  let orders = [];

  if (fs.existsSync(ORDERS_FILE)) {
    try {
      orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
    } catch {
      orders = [];
    }
  }

  orders.push(order);

  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
};

// 🔥 TEST
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// 🔥 CHECKOUT
app.post("/create-checkout", async (req, res) => {
  try {
    const { amount, orderId, customer } = req.body;

    const safeAmount = Number(amount);

    if (!safeAmount || isNaN(safeAmount) || safeAmount < 50) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (!customer?.email) {
      return res.status(400).json({ error: "Email required" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],

      mode: "payment",

      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: {
              name: "Order från MultiArt",
            },
            unit_amount: Math.round(safeAmount * 100),
          },
          quantity: 1,
        },
      ],

      customer_email: customer.email,

      metadata: {
        orderId: orderId || "ORDER_" + Date.now(),
        customerName: customer?.name || "",
        customerEmail: customer.email,
        address: customer?.address || "",
        city: customer?.city || "",
        postalCode: customer?.postalCode || "",
        country: customer?.country || "",
        zone: customer?.zone || "",
        shippingPrice: customer?.shippingPrice || "",
      },

      success_url: `https://www.multiartlink.com/confirmation`,
      cancel_url: `https://www.multiartlink.com/checkout`,
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("❌ Stripe error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🔥 WEBHOOK
app.post("/webhook", (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.log("❌ Webhook error:", err.message);
    return res.status(400).send(err.message);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    const order = {
      id: session.metadata.orderId,
      amount: session.amount_total / 100,
      customer: {
        name: session.metadata.customerName,
        email: session.metadata.customerEmail,
        address: session.metadata.address,
        city: session.metadata.city,
        postalCode: session.metadata.postalCode,
        country: session.metadata.country,
      },
      shipping: {
        zone: session.metadata.zone,
        price: session.metadata.shippingPrice,
      },
      status: "PAID",
      createdAt: new Date().toISOString(),
    };

    console.log("💰 ORDER:", order);

    saveOrder(order);
  }

  res.json({ received: true });
});

// 🔥 GET ORDERS
app.get("/orders", (req, res) => {
  if (!fs.existsSync(ORDERS_FILE)) {
    return res.json([]);
  }

  const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
  res.json(orders);
});

// 🔥 START
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("Server running 🚀");
});
