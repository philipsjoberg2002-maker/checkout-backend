import express from "express";
import Stripe from "stripe";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const stripe = new Stripe("sk_test_xxx");

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

app.post("/create-checkout", async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "klarna"],
      line_items: [
        {
          price_data: {
            currency: "sek",
            product_data: { name: "Order" },
            unit_amount: Math.round(Number(amount) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",

      success_url: `https://DIN-LOVABLE-URL/confirmation?orderId=${orderId}`,
      cancel_url: `https://DIN-LOVABLE-URL/checkout`,
    });

    res.json({ url: session.url });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log("Server running");
});
