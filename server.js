import express from "express";
import Stripe from "stripe";
import cors from "cors";
import fs from "fs";
import nodemailer from "nodemailer";

const app = express();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 📧 EMAIL
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ⚠️ webhook
app.use("/webhook", express.raw({ type: "application/json" }));

app.use(cors());
app.use(express.json());

const ORDERS_FILE = "orders.json";

// 💾 SAVE ORDER
const saveOrder = (order) => {
  let orders = [];
  if (fs.existsSync(ORDERS_FILE)) {
    orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
  }
  orders.push(order);
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
};

// 🔥 ADMIN AUTH (enkelt skydd)
const ADMIN_KEY = "12345"; // ändra senare

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
      payment_method_types: ["card", "klarna"],
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

      success_url: `https://www.multiartlink.com/confirmation?orderId=${orderId}`,
      cancel_url: `https://www.multiartlink.com/checkout`,
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 🔥 WEBHOOK
app.post("/webhook", async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
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
      },
      shipping: {
        zone: session.metadata.zone,
        price: session.metadata.shippingPrice,
      },
      status: "PAID",
      createdAt: new Date().toISOString(),
    };

    saveOrder(order);

    // 📧 EMAIL TILL DIG
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: `Ny order ${order.id}`,
      text: JSON.stringify(order, null, 2),
    });

    // 📧 EMAIL TILL KUND
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: order.customer.email,
      subject: "Orderbekräftelse",
      text: `
Tack för din beställning!

Order: ${order.id}
Belopp: ${order.amount} SEK

Vi återkommer med leverans via LGT.
      `,
    });

    // 🚚 LGT TRIGGER (redo)
    console.log("🚚 SKICKA TILL LGT:", order);
  }

  res.json({ received: true });
});

// 🔥 ADMIN PANEL API
app.get("/admin/orders", (req, res) => {
  const key = req.headers["x-api-key"];

  if (key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Unauthorized" });
  }

  if (!fs.existsSync(ORDERS_FILE)) {
    return res.json([]);
  }

  const orders = JSON.parse(fs.readFileSync(ORDERS_FILE));
  res.json(orders);
});

// 🔥 START
app.listen(process.env.PORT || 3001);
