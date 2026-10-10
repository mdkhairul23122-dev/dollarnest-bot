# DollarNest USDT (BSC BEP-20) Auto Micro-Payout Bot 🚀

একটি স্বয়ংক্রিয় টেলিগ্রাম বট যা BSC (Binance Smart Chain) নেটওয়ার্কের USDT (BEP-20) উইথড্র ট্রানজেকশনগুলো অ্যানালাইসিস করে **$0.10 থেকে $0.50** রেঞ্জের পেমেন্টগুলো প্রতি মিনিটে ৩টি করে [@DollarNest_Payout](https://t.me/DollarNest_Payout) চ্যানেলে প্রুফ হিসেবে পোস্ট করে।

---

## 📸 মেসেজ ফরম্যাট:
```text
DollarNest Payout review
🚀 New Withdrawal Confirmed! (BSC Network)

🌐 Username: @user_1734657011
💰 Amount: 0.3500 USDT
📥 From: 0x1cc0...a3ad
📤 To: 0xaa28...0246
🌐 Network: Binance Smart Chain (BEP-20)
🕒 Time: Oct 10, 2026, 6:12:38 PM
🤖 Bot: @DollarNestBot

🔗 View on BscScan
[BscScan Rich Web Embed Preview]
```

---

## ⚙️ কনফিগারেশন সেটিংস (.env):
- **Amount Range:** `0.1` USDT - `0.5` USDT
- **Frequency:** প্রতি মিনিটে ৩টি পোস্ট (প্রতি ২০ সেকেন্ডে ১টি)
- **Target Channel:** `@DollarNest_Payout`
- **Link Preview:** BscScan প্রিভিউ কার্ড সহ

---

## 🚀 কীভাবে চালু করবেন (Run Bot):
- **Windows:** ফোল্ডারে থাকা `start.bat` ফাইলে ডাবল ক্লিক করুন।
- **অথবা টার্মিনালে:**
  ```bash
  npm start
  ```
