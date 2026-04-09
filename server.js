import express from "express";
import Stripe from "stripe";
import cors from "cors";

const app = express();

// 🔐 STRIPE
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ⚠️ Webhook behöver raw body
app.use("/webhook", express.raw({ type: "application/json" }));

app.use(cors());
app.use(express.json());

// 🔥 TEST
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// 🔥 CHECKOUT
app.post("/create-checkout", async (req, res) => {
  try {
    const { amount, orderId, customer } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "klarna"],

      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: {
              name: "Order från MultiArt",
            },
            unit_amount: Math.round(Number(amount) * 100),
          },
          quantity: 1,
        },
      ],

      mode: "payment",

      // 🔥 SPARA DATA
      metadata: {
        orderId,
        customerName: customer?.name || "",
        customerEmail: customer?.email || "",
        address: customer?.address || "",
        city: customer?.city || "",
        postalCode: customer?.postalCode || "",
        country: customer?.country || "",
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

// 🔥 WEBHOOK (DETTA ÄR MAGIN)
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
    console.log("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // 🎯 NÄR BETALNING ÄR KLAR
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    console.log("💰 BETALNING KLAR:", session.metadata);

    // 👉 HÄR KAN DU:
    // - spara order i databas
    // - skicka mail
    // - boka LGT

    // EXEMPEL (logg)
    console.log("Order ID:", session.metadata.orderId);
    console.log("Kund:", session.metadata.customerName);
    console.log("Adress:", session.metadata.address);
  }

  res.json({ received: true });
});

// 🔥 PORT
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("Server running 🚀");
});
