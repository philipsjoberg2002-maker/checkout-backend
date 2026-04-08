import express from "express";
import Stripe from "stripe";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// 🔐 HÄMTAR STRIPE KEY FRÅN RAILWAY (VIKTIGT)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 🔥 TEST ROUTE
app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

// 🔥 CREATE CHECKOUT
app.post("/create-checkout", async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: "Ogiltigt belopp" });
    }

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

      // 🔥 DIN RIKTIGA DOMÄN
      success_url: `https://www.multiartlink.com/confirmation?orderId=${orderId}`,
      cancel_url: `https://www.multiartlink.com/checkout`,
    });

    res.json({ url: session.url });

  } catch (err) {
    console.error("Stripe error:", err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// 🔥 PORT FÖR RAILWAY
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
