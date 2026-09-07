// ─── Demo data generator ───
// Provides realistic mock data for all dashboard sections when Google credentials are not configured.

const seed = (n) => {
  let s = n;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
};

const rand = seed(42);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const randFloat = (min, max, dp = 2) => parseFloat((rand() * (max - min) + min).toFixed(dp));

// ─── Realistic data pools ───
const firstNames = ["Aanya", "Arjun", "Diya", "Rohan", "Isha", "Kabir", "Meera", "Vihaan", "Ananya", "Reyansh",
  "Saanvi", "Aarav", "Priya", "Aditya", "Navya", "Krishna", "Riya", "Vivaan", "Kiara", "Shaurya",
  "Tara", "Yash", "Zara", "Dhruv", "Ira", "Aarush", "Myra", "Om", "Sara", "Kian",
  "Anika", "Rudra", "Pari", "Neil", "Esha", "Ayan", "Nina", "Jai", "Tia", "Rahul",
  "Kavya", "Arnav", "Laila", "Veer", "Shanaya", "Ishan", "Avni", "Aadhya", "Dev", "Nisha"];
const lastNames = ["Sharma", "Mehta", "Kapoor", "Singh", "Patel", "Iyer", "Khan", "Reddy", "Joshi", "Desai",
  "Nair", "Gupta", "Bhat", "Rao", "Malhotra", "Chopra", "Banerjee", "Menon", "Agarwal", "Verma",
  "Saxena", "Bose", "Pillai", "Chandra", "Mukherjee", "Dutta", "Sethi", "Kothari", "Lala", "Wadhwa"];

const locations = ["Kwality House, Kemps Corner", "Kenkere House"];
const trainers = [
  { id: "54199", name: "Reshma Sharma", email: "reshma@physique57india.com" },
  { id: "468212", name: "Maysaa Nafis", email: "maysaa@physique57india.com" },
  { id: "53133", name: "Anisha Shah", email: "anisha@physique57india.com" },
  { id: "54196", name: "Atulan Purohit", email: "atulan@physique57mumbai.com" },
  { id: "54200", name: "Janhavi Jain", email: "janhavi@physique57mumbai.com" },
  { id: "54210", name: "Cauveri Vikrant", email: "cauveri@physique57india.com" },
  { id: "54220", name: "Richard D'Costa", email: "richard@physique57india.com" },
  { id: "54230", name: "Kajol Kanchan", email: "kajol@physique57india.com" },
];

const products = [
  { name: "Studio 1 Month Unlimited", category: "Memberships", price: 12500 },
  { name: "Studio 3 Month Unlimited", category: "Memberships", price: 32000 },
  { name: "Studio 6 Month Unlimited", category: "Memberships", price: 58000 },
  { name: "Studio 12 Class Package", category: "Packages", price: 14500 },
  { name: "Studio 24 Class Package", category: "Packages", price: 26500 },
  { name: "Studio Single Class", category: "Sessions/Single Classes", price: 2200 },
  { name: "Studio 4 Class Package", category: "Packages", price: 7600 },
  { name: "Newcomers 2 For 1", category: "Newcomers Special", price: 3200 },
  { name: "Studio Open Barre Class", category: "Complimentary/Promotional", price: 0 },
];

const classes = ["Barre 57", "Strength 57", "Power 57", "Studio Barre 57", "Studio Open Barre Class", "Physique 57 x Hosted Class"];
const sources = ["Instagram", "Google", "Referral", "Website", "Walk-in", "Facebook", "Yellow Messenger", "Event"];
const channels = ["Social Media & Influencer Marketing", "Referrals & Word-of-Mouth", "Digital Advertising", "Organic Search", "Events & activations", "Partnerships"];
const stages = ["New", "Contacted", "Trial Done", "Follow Up", "Negotiation", "Membership Sold"];
const statuses = ["Won", "Lost", "Active", "Not Interested"];
const conversionStatuses = ["Converted", "Not Converted", "Converted", "Converted", "Not Converted", "Converted"];
const retentionStatuses = ["Active", "Active", "Active", "Lapsed", "Active", "Churned", "Active", "Lapsed"];
const lifecycleStatuses = ["Active", "Active", "Active", "90+ Days Lapsed", "Active", "Churned", "Active", "90+ Days Active"];
const speedBuckets = ["0-7 Days", "8-14 Days", "15-30 Days", "31-60 Days", "61-90 Days", "90+ Days"];
const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const times = ["06:30:00", "07:30:00", "08:30:00", "09:30:00", "10:00:00", "11:15:00", "12:45:00", "17:00:00", "18:00:00", "19:00:00"];

// ─── Date helpers ───
const today = new Date();
const daysAgo = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() - n);
  return d;
};
const formatDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const formatDateTime = (d) => `${formatDate(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
const monthYear = (d) => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]}-${d.getFullYear()}`;
};

// ─── Generate members pool (shared across datasets) ───
const memberPool = Array.from({ length: 500 }, (_, i) => {
  const first = pick(firstNames);
  const last = pick(lastNames);
  return {
    id: String(10000000 + i * 137),
    first,
    last,
    name: `${first} ${last}`,
    email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@gmail.com`,
    phone: `91${randInt(7000000000, 9999999999)}`,
    firstVisit: daysAgo(randInt(0, 600)),
    location: pick(locations),
  };
});

// ═══════════════════ SALES SHEET ═════════════════════
function generateSales() {
  const header = ["Member ID", "Customer Name", "Customer Email", "Paying Member ID", "Sale Item ID", "Payment Date",
    "Payment Value", "Paid In Money Credits", "Payment VAT", "Payment Status", "Payment Method",
    "Payment Transaction ID", "Stripe Token", "Sold By", "Sale Reference", "Calculated Location",
    "Cleaned Product", "Cleaned Category", "Host Id", "Purchase Type", "Payment Source",
    "Paid In Event Credits", "Price Excluding VAT In Currency", "Discount Value In Currency", "Discount Code",
    "Created At", "Modified At", "Sale ID", "Sale Total Discount Value", "Sale Item Quantity",
    "Sale Item Unit Price Including VAT", "Sale Item Unit Price Excluding VAT", "Sale Item Unit VAT Amount",
    "Sale Item Unit Discount Value", "Sec. Is Voided", "Sec. Membership ID", "Sec. Membership Start Date",
    "Sec. Membership End Date", "Sec. Membership Total Classes", "Sec. Membership Classes Left",
    "Sec. Membership Total Money", "Sec. Membership Money Left", "Sec. Membership Type",
    "Sec. Membership Is Freezed", "Sec. Membership Used Session Credits",
    "Sec. Membership Revenue Per Event Credit Incl VAT", "Sec. Membership Activated On First Use",
    "Sec. Membership Name"];

  const rows = [header];
  const sellers = ["Vahishta Fitter", "Zahur Shaikh", "Admin Admin", "Diya Mehta", "Rohan Sharma"];

  for (let i = 0; i < 600; i++) {
    const member = pick(memberPool);
    const product = pick(products);
    const saleDate = daysAgo(randInt(0, 540));
    const vat = Math.round(product.price * 0.05);
    const discount = rand() < 0.3 ? Math.round(product.price * randFloat(0.05, 0.15)) : 0;
    const discountCode = discount > 0 ? pick(["NEW10", "FESTIVE15", "LOYAL5", "REFERRAL", "WELCOME20", "-"]) : "-";
    const status = rand() < 0.94 ? "succeeded" : pick(["refunded", "failed"]);
    const isVoided = rand() < 0.02 ? "TRUE" : "FALSE";
    const seller = pick(sellers);
    const location = pick(locations);
    const isMembership = /membership/i.test(product.category);
    const purchaseType = isMembership ? "membership" : /package/i.test(product.category) ? "package" : "session";

    rows.push([
      member.id, member.name, member.email, member.id, String(300000000 + i),
      formatDateTime(saleDate), String(product.price + vat), "0.00", String(vat),
      status, pick(["custom", "online", "pos"]), String(300000000 + i), "tok_" + randInt(100000, 999999),
      seller, String(300000000 + i), location, product.name, product.category, "13752",
      purchaseType, pick(["pos", "checkout-pages", "mobile-app"]),
      "0.00", String(product.price), String(discount), discountCode,
      formatDateTime(saleDate), formatDateTime(saleDate), String(320000000 + i),
      String(discount), "1", String(product.price + vat), String(product.price), String(vat), String(discount),
      isVoided,
      isMembership ? String(70000000 + i) : "-",
      isMembership ? formatDateTime(saleDate) : "-",
      isMembership ? formatDateTime(daysAgo(randInt(-30, -1))) : "-",
      isMembership ? String(pick([2, 4, 8, 12, 24, 48])) : "-",
      isMembership ? String(randInt(0, 12)) : "-",
      isMembership ? String(product.price + vat) : "-",
      isMembership ? String(randInt(0, product.price)) : "-",
      isMembership ? pick(["package-events", "subscription", "-"]) : "-",
      rand() < 0.05 ? "TRUE" : "FALSE",
      isMembership ? String(randInt(0, 8)) : "-",
      isMembership ? String(randFloat(800, 2500)) : "-",
      isMembership ? formatDateTime(saleDate) : "-",
      product.name,
    ]);
  }
  return rows;
}

// ═══════════════════ SESSIONS SHEET ═════════════════════
function generateSessions() {
  const header = ["TrainerID", "FirstName", "LastName", "Trainer", "SessionID", "SessionName",
    "Capacity", "CheckedIn", "LateCancelled", "Booked", "Complimentary", "Location",
    "Date", "Day", "Time", "Revenue", "NonPaid", "UniqueID1", "UniqueID2",
    "Memberships", "Packages", "IntroOffers", "SingleClasses", "Type", "Class", "Classes"];

  const rows = [header];
  for (let i = 0; i < 400; i++) {
    const trainer = pick(trainers);
    const sessionDate = daysAgo(randInt(0, 365));
    const day = weekdays[(sessionDate.getDay() + 6) % 7];
    const time = pick(times);
    const capacity = pick([12, 16, 20, 24]);
    const fillRate = randFloat(0.3, 0.95);
    const checkedIn = Math.round(capacity * fillRate);
    const booked = Math.round(checkedIn * randFloat(1.05, 1.3));
    const lateCancelled = rand() < 0.12 ? randInt(1, 3) : 0;
    const complimentary = rand() < 0.1 ? randInt(1, 2) : 0;
    const revenue = Math.round(checkedIn * randFloat(800, 2200));
    const cls = pick(classes);
    const format = /Barre/.test(cls) ? "Barre 57" : /Strength/.test(cls) ? "Strength 57" : "Power 57";

    rows.push([
      trainer.id, trainer.name.split(" ")[0], trainer.name.split(" ").slice(1).join(" "),
      trainer.name, String(140000000 + i), cls,
      String(capacity), String(checkedIn), String(lateCancelled), String(booked), String(complimentary),
      pick(locations), formatDate(sessionDate), day, time,
      String(revenue), String(lateCancelled + complimentary),
      `${format}|${day}|${time}|${pick(locations)}`.toLowerCase(),
      `${format}|${day}|${time}|${pick(locations)}|${trainer.name}`.toLowerCase(),
      String(Math.round(checkedIn * randFloat(0.3, 0.6))),
      String(Math.round(checkedIn * randFloat(0.2, 0.4))),
      String(Math.round(checkedIn * randFloat(0.1, 0.3))),
      String(Math.round(checkedIn * randFloat(0.1, 0.3))),
      format, cls, "1",
    ]);
  }
  return rows;
}

// ═══════════════════ RECURRING SHEET ═════════════════════
function generateRecurring() {
  const header = [...generateSessions()[0], "EmptySessions", "NonEmptySessions", "TotalCheckedInSum", "TotalCapacitySum",
    "TotalRevenueSum", "ClassAvgInclEmpty", "ClassAvgExclEmpty", "FillRate", "WeightedAverage", "Top5Trainers"];
  const sessions = generateSessions();
  const rows = [header];
  for (let i = 1; i < Math.min(sessions.length, 100); i++) {
    const row = [...sessions[i]];
    const checked = Number(row[7]) || 0;
    const cap = Number(row[6]) || 1;
    row.push(randInt(0, 2), randInt(1, 5), String(checked), String(cap), String(Number(row[15]) || 0),
      (checked / Math.max(1, randInt(2, 5))).toFixed(2), (checked / Math.max(1, randInt(1, 3))).toFixed(2),
      ((checked / cap) * 100).toFixed(2) + "%", String(randFloat(0, 2000)),
      `${pick(trainers).name} (${randInt(5, 25)}), ${pick(trainers).name} (${randInt(3, 15)})`);
    rows.push(row);
  }
  return rows;
}

// ═══════════════════ TEACHER RECURRING SHEET ═════════════════════
function generateTeacherRecurring() {
  const header = [...generateSessions()[0], "TotalSessions", "EmptySessions", "NonEmptySessions",
    "TotalCheckedInSum", "TotalCapacitySum", "TotalRevenueSum", "ClassAvgInclEmpty",
    "ClassAvgExclEmpty", "FillRate", "WeightedAverage"];
  const sessions = generateSessions();
  const rows = [header];
  for (let i = 1; i < Math.min(sessions.length, 80); i++) {
    const row = [...sessions[i]];
    const checked = Number(row[7]) || 0;
    const cap = Number(row[6]) || 1;
    row.push(String(randInt(2, 20)), String(randInt(0, 3)), String(randInt(2, 18)),
      String(checked), String(cap), String(Number(row[15]) || 0),
      (checked / Math.max(1, randInt(2, 5))).toFixed(2), (checked / Math.max(1, randInt(1, 3))).toFixed(2),
      ((checked / cap) * 100).toFixed(2) + "%", String(randFloat(0, 2000)));
    rows.push(row);
  }
  return rows;
}

// ═══════════════════ PAYROLL SHEET ═════════════════════
function generatePayroll() {
  const header = ["Teacher ID", "Teacher Name", "Teacher Email", "Location", "Cycle Sessions",
    "Empty Cycle Sessions", "Non-Empty Cycle Sessions", "Cycle Customers", "Cycle Paid",
    "Strength Sessions", "Empty Strength Sessions", "Non-Empty Strength Sessions",
    "Strength Customers", "Strength Paid", "Barre Sessions", "Empty Barre Sessions",
    "Non-Empty Barre Sessions", "Barre Customers", "Barre Paid", "Total Sessions",
    "Total Empty Sessions", "Total Non-Empty Sessions", "Total Customers", "Total Paid",
    "Month Year", "Unique Key", "Converted", "Conversion Rate", "Retained", "Retention Rate", "New"];
  const rows = [header];

  for (const trainer of trainers) {
    for (let m = 0; m < 12; m++) {
      const date = daysAgo(m * 30 + randInt(0, 10));
      const location = pick(locations);
      const sessions = randInt(15, 40);
      const empty = randInt(0, 5);
      const customers = randInt(80, 220);
      const revenue = randInt(60000, 180000);
      const newMembers = randInt(0, 8);
      const converted = Math.round(newMembers * randFloat(0.2, 0.7));
      const retained = Math.round(newMembers * randFloat(0.3, 0.8));

      rows.push([
        trainer.id, trainer.name, trainer.email, location,
        "0", "0", "0", "0", "₹0",
        String(randInt(5, 15)), String(randInt(0, 2)), String(randInt(5, 13)),
        String(randInt(30, 80)), `₹${randInt(20000, 60000)}`,
        String(randInt(10, 25)), String(randInt(0, 3)), String(randInt(10, 22)),
        String(randInt(60, 180)), `₹${randInt(40000, 130000)}`,
        String(sessions), String(empty), String(sessions - empty),
        String(customers), `₹${revenue}`,
        monthYear(date),
        `${trainer.id}-${location}-${monthYear(date)}`,
        String(converted), newMembers ? ((converted / newMembers) * 100).toFixed(1) + "%" : "0.0%",
        String(retained), newMembers ? ((retained / newMembers) * 100).toFixed(1) + "%" : "0.0%",
        String(newMembers),
      ]);
    }
  }
  return rows;
}

// ═══════════════════ NEW CLIENTS SHEET ═════════════════════
function generateNewClients() {
  const header = ["Member Id", "First Name", "Last Name", "Email", "Phone Number",
    "First Visit Date", "First Visit Entity Name", "First Visit Type", "First Visit Location",
    "Payment Method", "Membership Used", "Home Location", "Class No", "Trainer Name",
    "Is New", "Visits Post Trial", "Post Trial Same Month", "Late Cancellations",
    "Post Trial Memberships Bought", "Post Trial Purchase Count", "Post Trial First Purchase",
    "Post Trial First Purchase Value", "Ltv", "Retention Status", "Conversion Status",
    "First Purchase Date", "No of Visits", "Last Visit Date", "Days Since Last Visit",
    "Conversion Span (Days)", "Days To Second Visit", "Unique Locations Visited", "Month", "Year",
    "Source", "Ltv Post Trial", "Avg Purchase Value Post Trial", "Post Trial Last Purchase Date",
    "Last Purchase Value", "Total Purchases All Time", "Days Active", "Visits Per Month",
    "Late Cancel Rate Post Trial", "First Visit Day", "First Visit Time Slot",
    "Conversion Speed Bucket", "Lifecycle Status"];
  const rows = [header];

  for (let i = 0; i < 200; i++) {
    const member = memberPool[i % memberPool.length];
    const firstVisit = member.firstVisit;
    const convStatus = pick(conversionStatuses);
    const isConverted = convStatus === "Converted";
    const retStatus = pick(isConverted ? retentionStatuses : ["Not New", "Not New"]);
    const lifecycle = pick(isConverted ? lifecycleStatuses : ["Not Converted"]);
    const visits = isConverted ? randInt(1, 120) : randInt(0, 5);
    const purchases = isConverted ? randInt(1, 20) : 0;
    const ltv = isConverted ? randInt(2000, 200000) : 0;
    const convSpan = isConverted ? randInt(1, 120) : 0;
    const firstPurchase = isConverted ? randInt(2000, 25000) : 0;
    const trainer = pick(trainers);

    rows.push([
      member.id, member.first, member.last, member.email, member.phone,
      formatDate(firstVisit), "Import Visits", "session", "imported",
      pick(["imported", "pos", "checkout-pages"]), "",
      member.location, String(visits), trainer.name,
      visits > 0 ? "New" : "Not New",
      String(Math.max(0, visits - 1)), String(randInt(0, 3)), String(randInt(0, 4)),
      String(isConverted ? randInt(0, 3) : 0), String(purchases),
      isConverted ? pick(["Studio 1 Month Unlimited", "Studio 12 Class Package", "Studio Single Class", "Newcomers 2 For 1"]) : "",
      isConverted ? `₹${firstPurchase}` : "₹0",
      `₹${ltv}`, retStatus, convStatus,
      isConverted ? formatDate(daysAgo(randInt(0, firstVisit.getDate()))) : "",
      String(visits),
      visits > 0 ? formatDate(daysAgo(randInt(0, 30))) : "",
      String(visits > 0 ? randInt(0, 300) : 0),
      String(convSpan),
      String(convSpan > 0 ? randInt(1, convSpan) : 0),
      String(randInt(1, 3)),
      monthYear(firstVisit).split("-")[0], monthYear(firstVisit).split("-")[1],
      pick(sources),
      `₹${ltv}`, ltv > 0 ? `₹${Math.round(ltv / Math.max(1, purchases))}` : "₹0",
      purchases > 0 ? formatDate(daysAgo(randInt(0, 60))) : "",
      purchases > 0 ? `₹${randInt(2000, 25000)}` : "₹0",
      String(purchases),
      String(Math.max(1, Math.round((today - firstVisit) / 86400000))),
      visits > 0 ? (visits / Math.max(1, (today - firstVisit) / 86400000 * 30)).toFixed(2) : "0.00",
      randFloat(0, 40) + "%",
      pick(weekdays),
      pick(["Morning", "Afternoon", "Evening"]),
      pick(speedBuckets),
      lifecycle,
    ]);
  }
  return rows;
}

// ═══════════════════ LAPSED SHEET ═════════════════════
function generateLapsed() {
  const header = ["Member Name", "Member ID", "Member Email", "Member Phone", "Host ID", "Status",
    "Membership Name", "Sessions Limit", "Purchase Date", "Start Date", "End Date", "Churned Date",
    "Amount Paid", "Discount Code", "Discount Value", "Original Amount (Before Discount)", "Sold By",
    "Created By", "Most Recent Visit Date", "First Visit Date", "Total Sessions Completed",
    "Sessions Used", "% Remaining Sessions", "Total Cancellations", "Late Cancellations",
    "No Shows", "Cancellation Rate %", "Preferred Booking Method", "Primary Location",
    "Locations Attended", "Membership Freeze Count", "Days Frozen", "Membership Duration (Days)",
    "Days Active", "Days Since Last Visit", "Average Sessions Per Month", "Revenue Per Session", "Attendance Rate %"];
  const rows = [header];
  const membershipNames = ["Studio 1 Month Unlimited", "Studio 3 Month Unlimited", "Studio 12 Class Package",
    "Studio Single Class", "Studio 24 Class Package", "Newcomers 2 For 1"];

  for (let i = 0; i < 120; i++) {
    const member = memberPool[(i + 50) % memberPool.length];
    const firstVisit = daysAgo(randInt(60, 500));
    const lastVisit = daysAgo(randInt(7, 180));
    const status = rand() < 0.4 ? "Active" : rand() < 0.7 ? "Expired" : "Churned";
    const churnedDate = status !== "Active" ? daysAgo(randInt(0, 90)) : null;
    const membership = pick(membershipNames);
    const sessionsCompleted = randInt(0, 80);
    const amountPaid = randInt(0, 80000);
    const daysSince = Math.round((today - lastVisit) / 86400000);

    rows.push([
      member.name, member.id, member.email, member.phone, "13752", status,
      membership, String(pick([2, 4, 8, 12, 24])),
      formatDate(daysAgo(randInt(60, 400))), formatDate(firstVisit),
      formatDate(daysAgo(randInt(0, 60))), churnedDate ? formatDate(churnedDate) : "",
      String(amountPaid), pick(["-", "NEW10", "FESTIVE15"]),
      String(amountPaid > 0 ? randInt(0, Math.round(amountPaid * 0.15)) : 0),
      String(amountPaid), pick(["Vahishta Fitter", "Zahur Shaikh", "Admin Admin"]), member.name,
      formatDate(lastVisit), formatDate(firstVisit),
      String(sessionsCompleted), String(randInt(0, sessionsCompleted)),
      String(randInt(0, 100)),
      String(randInt(0, 15)), String(randInt(0, 5)), String(randInt(0, 3)),
      randFloat(0, 35) + "%",
      pick(["mobile-app", "checkout-pages", "website"]),
      member.location, String(randInt(1, 2)),
      String(randInt(0, 2)), String(randInt(0, 30)),
      String(randInt(30, 365)),
      String(Math.round((today - firstVisit) / 86400000)),
      String(daysSince),
      (sessionsCompleted / Math.max(1, (today - firstVisit) / 86400000 / 30)).toFixed(2),
      amountPaid > 0 ? `₹${Math.round(amountPaid / Math.max(1, sessionsCompleted))}` : "₹0",
      randFloat(20, 100) + "%",
    ]);
  }
  return rows;
}

// ═══════════════════ BOOKINGS SHEET ═════════════════════
function generateBookings() {
  const header = ["Member Id", "Sale Date", "Customer Name", "Customer Email", "Sale Value",
    "Sale Item", "Sale Id", "Session Date", "Payment Method", "Membership Used",
    "Stripe Token", "Refunded", "Vat", "Location Name", "Sold By", "Cancelled",
    "Late Cancelled", "No Show", "Trainer Id", "Teacher Name", "Cleaned Class Attended",
    "Class No", "Is New", "Day Of Week", "Time Slot", "Host Id", "UniqueID1", "UniqueID2"];
  const rows = [header];

  for (let i = 0; i < 400; i++) {
    const member = pick(memberPool);
    const saleDate = daysAgo(randInt(0, 300));
    const sessionDate = daysAgo(randInt(0, 300));
    const day = weekdays[(sessionDate.getDay() + 6) % 7];
    const trainer = pick(trainers);
    const cancelled = rand() < 0.15;
    const lateCancelled = cancelled && rand() < 0.4;
    const noShow = !cancelled && rand() < 0.06;
    const cls = pick(classes);
    const time = pick(times);
    const timeSlot = `${Number(time.split(":")[0]) < 12 ? "Morning" : Number(time.split(":")[0]) < 17 ? "Afternoon" : "Evening"}`;

    rows.push([
      member.id, formatDateTime(saleDate), member.name, member.email,
      `₹${randInt(0, 3500)}`, pick(["Import Visits", "Studio Single Class", "Studio 1 Month Unlimited", "Package"]),
      String(100000000 + i), formatDateTime(sessionDate),
      pick(["imported", "Online", "pos"]), pick(["imported", "Studio 1 Month Unlimited", "-"]),
      `₹${randInt(0, 100)}`, pick(["₹0.00", "FALSE"]), "₹0",
      pick(locations), pick(["Admin Admin", "Vahishta Fitter", "Zahur Shaikh"]),
      String(cancelled), String(lateCancelled), String(noShow),
      trainer.id, trainer.name, cls,
      String(randInt(1, 5)), pick(["New", "Returning"]),
      day, timeSlot, "13752",
      `${cls}|${day}|${time}|${pick(locations)}`.toLowerCase(),
      `uid2_${i}`,
    ]);
  }
  return rows;
}

// ═══════════════════ LEADS SHEET ═════════════════════
function generateLeads() {
  const header = ["ID", "Full Name", "Phone Number", "Email", "Created At", "Source ID",
    "Source Name", "Member ID", "Converted To Customer At", "Stage Name", "Associate",
    "Remarks", "Follow Up 1 Date", "Follow Up Comments (1)", "Follow Up 2 Date",
    "Follow Up Comments (2)", "Follow Up 3 Date", "Follow Up Comments (3)",
    "Follow Up 4 Date", "Follow Up Comments (4)", "Center", "Class Type",
    "Host ID", "Status", "Channel", "Period"];
  const rows = [header];
  const associates = ["Zahur Shaikh", "Vahishta Fitter", "Diya Mehta", "Rohan Sharma"];
  const remarks = ["Interested in membership", "Requested trial class", "Pricing query", "Location enquiry",
    "Follow up next week", "Called back later", "Whatsapp message sent", "Not reachable"];

  for (let i = 0; i < 180; i++) {
    const member = pick(memberPool);
    const created = daysAgo(randInt(0, 500));
    const status = pick(statuses);
    const won = status === "Won";
    const followUps = randInt(0, 4);
    const source = pick(sources);
    const channel = pick(channels);

    rows.push([
      String(1100000 + i), member.name, member.phone, member.email,
      formatDateTime(created), String(8000 + i),
      source, won ? member.id : "-",
      won ? formatDate(daysAgo(randInt(0, created.getDate()))) : "-",
      won ? "Membership Sold" : pick(stages),
      pick(associates),
      pick(remarks),
      followUps >= 1 ? formatDate(daysAgo(randInt(0, created.getDate() - 5))) : "",
      followUps >= 1 ? pick(remarks) : "",
      followUps >= 2 ? formatDate(daysAgo(randInt(0, created.getDate() - 10))) : "",
      followUps >= 2 ? pick(remarks) : "",
      followUps >= 3 ? formatDate(daysAgo(randInt(0, created.getDate() - 15))) : "",
      followUps >= 3 ? pick(remarks) : "",
      followUps >= 4 ? formatDate(daysAgo(randInt(0, created.getDate() - 20))) : "",
      followUps >= 4 ? pick(remarks) : "",
      pick(locations), pick(["Barre 57", "Strength 57", "Power 57"]),
      "13752", status, channel, "All Time",
    ]);
  }
  return rows;
}

// ═══════════════════ CHECKINS SHEET ═════════════════════
function generateCheckins() {
  const header = ["Member ID", "First Name", "Last Name", "Email", "Order At", "Paid",
    "Payment Method Name", "Checked In", "Complementary", "Is Late Cancelled",
    "Session ID", "Session Name", "Capacity", "Location", "Date (IST)", "Day of Week",
    "Time", "Duration (Minutes)", "Teacher Name", "Cleaned Product", "Cleaned Category",
    "Cleaned Class", "Host ID", "Month", "Year", "Class No", "Is New", "UniqueID1", "UniqueID2"];
  const rows = [header];

  for (let i = 0; i < 300; i++) {
    const member = pick(memberPool);
    const sessionDate = daysAgo(randInt(0, 365));
    const day = weekdays[(sessionDate.getDay() + 6) % 7];
    const time = pick(times);
    const trainer = pick(trainers);
    const cls = pick(classes);

    rows.push([
      member.id, member.first, member.last, member.email,
      formatDateTime(sessionDate), pick(["0", "48.68", "2200", "12500"]),
      pick(["Studio 3 Month Unlimited Membership", "Studio Single Class", "-"]),
      "TRUE", rand() < 0.1 ? "TRUE" : "FALSE", rand() < 0.1 ? "TRUE" : "FALSE",
      String(90000000 + i), cls, String(pick([12, 16, 20, 24])),
      pick(locations), formatDate(sessionDate), day, time, "55",
      trainer.name, pick(["Studio 1 Month Unlimited", "Studio Single Class", "Studio Open Barre Class"]),
      pick(["Memberships", "Sessions/Single Classes", "Complimentary/Promotional"]),
      cls, "13752",
      monthYear(sessionDate).split("-")[0], monthYear(sessionDate).split("-")[1],
      String(randInt(1, 5)), pick(["New - Trial Class", "New - Others", "Returning"]),
      `uid1_${i}`, `uid2_${i}`,
    ]);
  }
  return rows;
}

// ═══════════════════ EXPORT ═════════════════════
export function generateDemoData() {
  return {
    sales: generateSales(),
    classes: {
      sessions: generateSessions(),
      sessionsSheet: "Demo Sessions",
      recurring: generateRecurring(),
      recurringSheet: "Demo Recurring",
      teacherRecurring: generateTeacherRecurring(),
      teacherSheet: "Demo Teacher Recurring",
    },
    intelligence: {
      payroll: generatePayroll(),
      payrollSheet: "Demo Payroll",
      members: generateNewClients(),
      membersSheet: "Demo New",
      bookings: generateBookings(),
      bookingsSheet: "Demo Bookings",
      leads: generateLeads(),
      leadsSheet: "Demo Leads",
      lapsed: generateLapsed(),
      lapsedSheet: "Demo Lapsed",
      checkins: generateCheckins(),
      checkinsSheet: "Demo Checkins",
    },
    syncedAt: new Date().toISOString(),
    _demo: true,
  };
}
