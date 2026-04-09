import express from "express";
import Stripe from "stripe";
import cors from "cors";

const app = express();

// 🔐 Stripe init
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ⚠️ Webhook måste ha raw body
app.use("/webhook", express.raw({ type: "application/json" }));

app.use(cors());
app.use(express.json());

// 🔥 TEST ROUTE
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// 🔥 CHECKOUT
app.post("/create-checkout", async (req, res) => {
  try {
    const { amount, orderId, customer } = req.body;

    console.log("📦 Incoming data:", req.body);

    // ✅ Säker amount
    const safeAmount = Number(amount);

    if (!safeAmount || isNaN(safeAmount)) {
      console.error("❌ Invalid amount:", amount);
      return res.status(400).json({ error: "Invalid amount" });
    }

    // ✅ fallback email (Stripe kräver ibland detta)
    const email = customer?.email || "test@test.com";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"], // 🔥 lägg tillbaka klarna senare

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

      mode: "payment",

      customer_email: email,

      metadata: {
        orderId: orderId || "test-order",
        customerName: customer?.name || "",
        customerEmail: email,
        address: customer?.address || "",
        city: customer?.city || "",
        postalCode: customer?.postalCode || "",
        country: customer?.country || "",
      },

      success_url: `https://www.multiartlink.com/confirmation?orderId=${orderId}`,
      cancel_url: `https://www.multiartlink.com/checkout`,
    });

    console.log("✅ Stripe session created:", session.id);

    res.json({ url: session.url });

  } catch (err) {
    console.error("❌ Stripe error:", err.message);
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
    console.log("❌ Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    console.log("💰 BETALNING KLAR:");
    console.log("Order ID:", session.metadata.orderId);
    console.log("Kund:", session.metadata.customerName);
    console.log("Adress:", session.metadata.address);
  }

  res.json({ received: true });
});

// 🔥 START SERVER
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("Server running 🚀");
});
