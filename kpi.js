/* ============================================================
   KPI engine: definitions, aggregation, Bangla explanations,
   row-level calculation rules and a small teaching sample.
   ============================================================ */
const sum=(rows,key)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0);
const divide=(n,d,m=1)=>d?n/d*m:null;

/* Step 1 of every KPI: build the totals ("s") from the filtered rows.
   Step 2: KPI = numerator total ÷ denominator total × multiplier. */
function aggregate(flights,aircraftDays,crewDays,finance,scope=true){
 const op=flights.filter(f=>f.status!=='Cancelled'),latest={};
 finance.forEach(r=>{if(!latest[r.airline]||latest[r.airline].month<r.month)latest[r.airline]=r;});
 const s={scheduled:flights.length,operated:op.length,cancelled:flights.length-op.length,diverted:op.filter(f=>f.status==='Diverted').length,ontime:op.filter(f=>f.status!=='Diverted'&&f.arrival_delay_min<15).length,delay:op.reduce((n,f)=>n+Math.max(0,f.arrival_delay_min),0),turns:op.filter(f=>f.turnaround_min!==null).length,turn:sum(op,'turnaround_min'),gate:sum(op,'gate_change'),passengers:sum(op,'passengers'),rpk:sum(op,'rpk'),ask:sum(op,'ask'),ctk:sum(op,'ctk'),actk:sum(op,'actk'),bag:sum(op,'baggage_kg'),delayed:sum(op,'delayed_bags'),lost:sum(op,'lost_bags'),damaged:sum(op,'damaged_bags'),complaints:sum(op,'complaints'),compliments:sum(op,'compliments'),revenue:sum(flights,'operating_revenue_eur'),passengerRevenue:sum(flights,'passenger_revenue_eur'),cost:sum(flights,'operating_cost_eur'),block:sum(aircraftDays,'block_hours'),aircraftDays:sum(aircraftDays,'aircraft_days'),crewHours:sum(crewDays,'pilot_block_hours'),crewDays:sum(crewDays,'pilot_person_days'),net:sum(finance,'net_profit_eur'),cashflow:sum(finance,'net_cashflow_eur'),ocf:sum(finance,'operating_cashflow_eur'),shortDebt:sum(Object.values(latest),'short_debt_eur'),longDebt:sum(Object.values(latest),'long_debt_eur')};
 s.mishandled=s.delayed+s.lost+s.damaged;s.profit=s.revenue-s.cost;
 const m={};for(const k of KPIS){let n=s[k.n],d=k.d?s[k.d]:1;m[k.id]={value:(!scope&&k.scope)||!flights.length?null:divide(n,d,k.mult||1),n,d};}return {m,s};
}

// [id, category, name, numerator, denominator, multiplier, unit, definition, formula, interpretation, mistake, airline-month scope]
const KPIS=[
 ['passengers','Commercial','Passengers','passengers',null,1,'passengers','Number of revenue passengers carried on the selected sectors. A connecting passenger is counted on each sector flown.','Sum of revenue passengers','Traffic volume depends on sample size and route mix.','Do not interpret sector passenger counts as unique people.'],
 ['rpk','Commercial','Revenue passenger kilometres (RPK)','rpk',null,1,'passenger-km','Passenger transport output, accounting for sector distance.','Σ(revenue passengers × sector km)','Higher RPK can reflect more passengers, longer flights or both.','Calculate each sector product before summing.'],
 ['ask','Commercial','Available seat kilometres (ASK)','ask',null,1,'seat-km','Passenger capacity offered on operated sectors.','Σ(available seats × sector km)','ASK rises with aircraft capacity, frequency or distance.','Cancelled sectors contribute no operated ASK in this dataset.'],
 ['plf','Commercial','Passenger load factor (PLF)','rpk','ask',100,'%','The share of available seat-kilometres used by revenue passengers.','(Total RPK ÷ Total ASK) × 100','A high load factor indicates capacity use; it does not establish profitability.','Do not simply average flight percentages; use total RPK and ASK.'],
 ['rask','Commercial','Revenue per ASK (RASK)','revenue','ask',1,'€/ASK','Operating revenue earned per available seat-kilometre.','Operating revenue ÷ ASK','Compare RASK with CASK using the same revenue, cost and network scope.','Passenger yield has a different denominator and revenue scope.'],
 ['cask','Commercial','Cost per ASK (CASK)','cost','ask',1,'€/ASK','Allocated operating cost per available seat-kilometre, including cancellation costs and depreciation.','Operating cost ÷ ASK','Route length and aircraft mix influence unit costs. Lower is not automatically better service.','A short-haul sample is not directly comparable with a long-haul network.'],
 ['yield','Commercial','Passenger yield','passengerRevenue','rpk',1,'€/RPK','Passenger revenue per revenue passenger-kilometre, excluding ancillary and cargo revenue here.','Passenger revenue ÷ RPK','Yield measures revenue per unit of passenger traffic, not capacity.','Do not divide total operating revenue by RPK and label it passenger yield.'],
 ['ctk','Cargo','Cargo tonne kilometres (CTK)','ctk',null,1,'tonne-km','Belly freight transport output; passenger baggage is excluded.','Σ(cargo kg ÷ 1,000 × sector km)','Cargo tonnes and distance both drive output.','Convert kilograms to metric tonnes first.'],
 ['actk','Cargo','Available cargo tonne kilometres (ACTK)','actk',null,1,'tonne-km','Offered belly freight capacity, using synthetic commercial cargo allocations.','Σ(available cargo kg ÷ 1,000 × sector km)','This is commercial freight allocation, not the aircraft maximum structural payload.','Do not include passenger baggage capacity in the cargo denominator.'],
 ['clf','Cargo','Cargo load factor (CLF)','ctk','actk',100,'%','Share of offered cargo tonne-kilometres used.','(CTK ÷ ACTK) × 100','Not applicable when no freight capacity is offered, as for Ryanair in this simulation.','Zero capacity means undefined load factor, not 0%.'],
 ['aircraftUtil','Operations','Sample aircraft utilisation','block','aircraftDays',1,'h/aircraft-day','Block hours flown in this selected-route simulation per aircraft calendar day, including idle days.','Sample block hours ÷ aircraft-days','These values are not full-network or actual airline utilisation. Route and distance filters disable this KPI.','Do not divide by only days with flights and call it calendar-day utilisation.',true],
 ['crewUtil','Operations','Sample pilot utilisation','crewHours','crewDays',1,'h/pilot-day','Pilot-person block hours per rostered pilot-person-day; two pilots per operated flight.','Pilot-person block hours ÷ pilot-person-days','Eight pilot-person-days per airline per day are assumed. This is not a duty-time or legal-limit analysis.','Aircraft hours and pilot-person hours differ. Route and distance filters disable this KPI.',true],
 ['turn','Operations','Average turnaround time','turn','turns',1,'min','Elapsed on-stand turnaround observations for the second sector of each simulated pair.','Total observed turnaround minutes ÷ observed turns','Compare within aircraft types. Standards: TK 45, LH 40, AY 40, BT 35, FR 25 minutes (synthetic).','Do not count an unobserved turnaround as zero. Minimum standards are not observed averages.'],
 ['delay','Operations','Mean arrival delay','delay','operated',1,'min','Non-negative arrival delay averaged over all operated sectors; early arrivals contribute zero.','Σ max(arrival delay, 0) ÷ operated sectors','The mean includes flights with zero delay and can be driven by a few severe disruptions.','A mean over only delayed flights answers a different question.'],
 ['otp','Operations','On-time performance (OTP)','ontime','operated',100,'%','Operated flights arriving less than 15 minutes late at their intended destination.','On-time operated flights ÷ all operated flights × 100','Cancelled flights are excluded. Diverted flights are operated but not on time.','Exactly 15 minutes late is not on time under this convention.'],
 ['gate','Operations','Gate change rate','gate','operated',100,'%','Share of operated departures experiencing at least one gate change.','Affected operated departures ÷ operated departures × 100','Each flight is counted once even if more than one change occurs.','Count flights affected, not the total number of gate-change events.'],
 ['cancel','Operations','Cancellation rate','cancelled','scheduled',100,'%','Share of scheduled sectors that did not operate.','Cancelled sectors ÷ scheduled sectors × 100','Use scheduled flights as the denominator and examine counts alongside rates.','Using operated flights in the denominator changes the measure.'],
 ['diversion','Operations','Diversion rate','diverted','operated',100,'%','Share of operated sectors that landed away from the intended destination.','Diverted sectors ÷ operated sectors × 100','Rare events produce unstable rates in a small sample.','A diversion is not a cancellation.'],
 ['bagPax','Baggage & service','Checked baggage per passenger','bag','passengers',1,'kg/passenger','Total checked baggage weight per revenue passenger, including those with no checked bags.','Checked baggage kg ÷ passengers','The average depends on baggage uptake and weight.','This excludes cabin baggage and uses all passengers.'],
 ['bagFlight','Baggage & service','Checked baggage per flight','bag','operated',1,'kg/flight','Mean checked baggage weight per operated sector.','Checked baggage kg ÷ operated sectors','Aircraft size and passenger count influence this average.','This is an average, not the total weight on a specific flight.'],
 ['bagAsk','Baggage & service','Baggage weight per ASK','bag','ask',1,'kg/ASK','Checked baggage weight relative to offered passenger capacity.','Checked baggage kg ÷ ASK','A teaching indicator affected by sector distance; not a universal industry benchmark.','This is not baggage tonne-kilometres divided by ASK.'],
 ['bagRpk','Baggage & service','Baggage weight per RPK','bag','rpk',1,'kg/RPK','Checked baggage weight relative to passenger traffic output.','Checked baggage kg ÷ RPK','Longer sectors increase the denominator without necessarily increasing baggage weight.','Do not treat this ratio as average baggage weight per passenger.'],
 ['mishandled','Baggage & service','Mishandled baggage rate','mishandled','passengers',1000,'bags/1,000 pax','Delayed, lost and damaged bags per 1,000 passengers. Categories are mutually exclusive here.','Mishandled bags ÷ passengers × 1,000','Use event counts and rates together for comparisons.','Do not count a bag both delayed and subsequently lost.'],
 ['delayed','Baggage & service','Delayed baggage rate','delayed','passengers',1000,'bags/1,000 pax','Bags eventually delivered late, excluding bags finally classified as lost.','Delayed bags ÷ passengers × 1,000','Measures late delivery frequency rather than delay duration.','Keep the final classification rule consistent across airlines.'],
 ['lost','Baggage & service','Lost baggage rate','lost','passengers',1000,'bags/1,000 pax','Bags finally classified as lost per 1,000 passengers.','Lost bags ÷ passengers × 1,000','Small counts cause substantial relative variation.','Zero observed losses does not prove zero underlying risk.'],
 ['complaints','Baggage & service','Passenger complaint rate','complaints','passengers',100000,'per 100,000 pax','Complaint submissions per 100,000 passengers.','Complaints ÷ passengers × 100,000','Submission behaviour and reporting channels affect rates.','Complaint submissions are not necessarily unique complainants.'],
 ['compliments','Baggage & service','Passenger compliment rate','compliments','passengers',100000,'per 100,000 pax','Compliment submissions per 100,000 passengers.','Compliments ÷ passengers × 100,000','This is one source of feedback, not a complete satisfaction score.','Do not subtract compliments from complaints to obtain satisfaction.'],
 ['profit','Financial','Operating profit','profit',null,1,'€','Operating revenue less allocated operating costs for the selected flight sample.','Operating revenue − operating costs','Positive operating profit does not mean positive net profit or cash flow.','This is simulated sample profit, not an airline financial statement.'],
 ['margin','Financial','Operating profit margin','profit','revenue',100,'%','Operating profit expressed as a percentage of operating revenue.','Operating profit ÷ operating revenue × 100','Allows scale-adjusted comparison, subject to route and accounting scope.','A high percentage margin can accompany a small absolute profit.'],
 ['net','Financial','Net profit','net',null,1,'€','Simulated operating profit less interest and tax.','Operating profit − interest − tax','Monthly airline-level simulation; unavailable under route or distance filters.','Profit is not cash flow.',true],
 ['ocf','Financial','Operating cash flow','ocf',null,1,'€','Net profit plus depreciation less the increase in working capital.','Net profit + depreciation − increase in working capital','Shows operating cash generated before investing and financing flows.','Do not confuse depreciation expense with a current-period cash outflow.',true],
 ['cashflow','Financial','Net cash flow','cashflow',null,1,'€','Operating cash flow less capital expenditure plus new borrowing less debt repayments.','Operating CF − capex + borrowing − repayments','Adds to opening cash to produce closing cash in the monthly table.','Borrowing increases cash without increasing operating profit.',true],
 ['shortDebt','Financial','Short-term debt','shortDebt',null,1,'€','Current debt balance at the end of the latest selected month, summed across selected airlines.','Latest closing current debt balance','A stock at a point in time, not a period flow.','Never sum monthly debt balances across the year.',true],
 ['longDebt','Financial','Long-term debt','longDebt',null,1,'€','Non-current debt at the end of the latest selected month. Lease liabilities are outside this simplified simulation.','Latest closing non-current debt balance','New borrowing and reclassification into current debt change the balance.','Do not sum monthly balances or interpret these figures as actual debt.',true]
].map(([id,category,name,n,d,mult,unit,definition,formula,interpretation,mistake,scope])=>({id,category,name,n,d,mult,unit,definition,formula,interpretation,mistake,scope:!!scope}));

/* ---------- বাংলা ব্যাখ্যা (short Bangla explanation for every KPI) ---------- */
const BN={
 passengers:{name:'যাত্রী সংখ্যা',def:'নির্বাচিত sector-গুলোতে মোট কতজন revenue passenger (টিকিট কেটে ভ্রমণকারী যাত্রী) বহন করা হয়েছে। একজন connecting যাত্রী প্রতিটি sector-এ আলাদা করে গোনা হয়।',tip:'এটা "আলাদা আলাদা মানুষ" নয় — একই যাত্রী দুই sector উড়লে ২ বার গোনা হয়।'},
 rpk:{name:'রেভিনিউ যাত্রী-কিলোমিটার',def:'প্রতিটি flight-এ যাত্রী × দূরত্ব (km), তারপর সব যোগ। যাত্রীরা মোট কত কিলোমিটার ভ্রমণ করেছে — airline-এর আসল passenger traffic output।',tip:'আগে প্রতিটি flight-এ গুণ করুন, তারপর যোগ করুন। মোট যাত্রী × মোট দূরত্ব করলে ভুল হবে।'},
 ask:{name:'প্রাপ্ত আসন-কিলোমিটার',def:'প্রতিটি operated flight-এ আসন (seat) × দূরত্ব (km), তারপর যোগ। airline বিক্রির জন্য কত seat-km অফার করেছে — অর্থাৎ capacity (ধারণক্ষমতা)।',tip:'বাতিল (Cancelled) flight-এর কোনো ASK নেই, কারণ ওই আসন আসলে আকাশে ওড়েনি।'},
 plf:{name:'যাত্রী লোড ফ্যাক্টর',def:'অফার করা seat-km-এর কত শতাংশ যাত্রী দিয়ে পূর্ণ হয়েছে — বিমান কতটা ভরা ছিল তার মাপকাঠি। RPK ÷ ASK × 100।',tip:'প্রতিটি flight-এর % বের করে গড় (average) করবেন না; মোট RPK ÷ মোট ASK করুন। বেশি PLF মানেই লাভ নয়।'},
 rask:{name:'প্রতি ASK-এ আয়',def:'প্রতি ১ seat-km অফার করে airline মোট কত ইউরো আয় (operating revenue — যাত্রী + ancillary + কার্গো) করেছে।',tip:'RASK-এর হর (denominator) হলো ASK (capacity); Yield-এর হর RPK (traffic) — দুটো আলাদা।'},
 cask:{name:'প্রতি ASK-এ খরচ',def:'প্রতি ১ seat-km উৎপাদনে কত ইউরো খরচ (unit cost) হয়েছে। RASK > CASK হলে লাভ, কম হলে লোকসান।',tip:'ছোট দূরত্বের (short-haul) flight-এ CASK সাধারণত বেশি হয় — দূরপাল্লার সাথে সরাসরি তুলনা করবেন না।'},
 yield:{name:'যাত্রী ইল্ড',def:'একজন যাত্রীকে ১ km বহন করে গড়ে কত ইউরো passenger revenue এসেছে — গড় "ভাড়ার হার"।',tip:'শুধু passenger revenue নিন; ancillary বা কার্গো আয় যোগ করলে সেটা yield থাকে না।'},
 ctk:{name:'কার্গো টন-কিলোমিটার',def:'কার্গো ওজন (টন) × দূরত্ব (km), তারপর যোগ। কত টন মালামাল কত দূর বহন করা হয়েছে (যাত্রীর baggage বাদে)।',tip:'আগে কেজিকে ১,০০০ দিয়ে ভাগ করে টন বানান।'},
 actk:{name:'প্রাপ্ত কার্গো টন-কিলোমিটার',def:'কার্গো ধারণক্ষমতা (টন) × দূরত্ব (km) — কার্গোর জন্য অফার করা capacity।',tip:'যাত্রীর baggage-এর জায়গা এর মধ্যে ধরবেন না।'},
 clf:{name:'কার্গো লোড ফ্যাক্টর',def:'অফার করা cargo capacity (ACTK)-এর কত শতাংশ আসলে ব্যবহার (CTK) হয়েছে।',tip:'capacity শূন্য হলে উত্তর "প্রযোজ্য নয় (N/A)", ০% নয় — শূন্য দিয়ে ভাগ করা যায় না।'},
 aircraftUtil:{name:'বিমান ব্যবহার হার',def:'প্রতিটি বিমান প্রতিদিন গড়ে কত ঘণ্টা উড়েছে (block hours ÷ aircraft-days), অলস (idle) দিনসহ।',tip:'শুধু যে দিনগুলোতে flight ছিল সেগুলো দিয়ে ভাগ করবেন না — সব ক্যালেন্ডার দিন ধরুন।'},
 crewUtil:{name:'পাইলট ব্যবহার হার',def:'প্রতিজন pilot প্রতি rostered দিনে গড়ে কত ঘণ্টা ফ্লাই করেছে। প্রতিটি flight-এ ২ জন pilot।',tip:'বিমানের ঘণ্টা আর pilot-person ঘণ্টা আলাদা (১ ঘণ্টা flight = ২ pilot-hours)।'},
 turn:{name:'গড় টার্নঅ্যারাউন্ড সময়',def:'বিমান stand-এ পৌঁছানোর পর আবার ছাড়া পর্যন্ত গড়ে কত মিনিট লেগেছে।',tip:'যেখানে turnaround মাপা হয়নি (blank), সেটাকে ০ ধরবেন না — বাদ দিন।'},
 delay:{name:'গড় আগমন বিলম্ব',def:'প্রতি operated flight-এ গড়ে কত মিনিট দেরিতে পৌঁছেছে। নির্ধারিত সময়ের আগে পৌঁছালে ০ ধরা হয় (negative নয়)।',tip:'শুধু দেরি হওয়া flight দিয়ে গড় করলে অন্য প্রশ্নের উত্তর হয় — সব operated flight দিয়ে ভাগ করুন।'},
 otp:{name:'অন-টাইম পারফরম্যান্স',def:'কত শতাংশ operated flight নির্ধারিত সময়ের ১৫ মিনিটের কম দেরিতে নির্ধারিত গন্তব্যে পৌঁছেছে (সময়ানুবর্তিতা)।',tip:'ঠিক ১৫ মিনিট দেরি = on-time নয়। Diverted flight কখনো on-time নয়।'},
 gate:{name:'গেট পরিবর্তনের হার',def:'কত শতাংশ departure-এ অন্তত একবার gate পরিবর্তন হয়েছে।',tip:'একটি flight-এ ২ বার gate বদলালেও flight একবারই গোনা হয়।'},
 cancel:{name:'বাতিলের হার',def:'নির্ধারিত (scheduled) flight-এর কত শতাংশ বাতিল (cancelled) হয়েছে।',tip:'হর (denominator) scheduled flight, operated নয়।'},
 diversion:{name:'ডাইভারশন হার',def:'চালু (operated) flight-এর কত শতাংশ নির্ধারিত গন্তব্যের বদলে অন্য বিমানবন্দরে নেমেছে।',tip:'Diversion আর cancellation এক নয় — diverted flight আসলে উড়েছে।'},
 bagPax:{name:'প্রতি যাত্রী ব্যাগেজ',def:'প্রতি যাত্রী গড়ে কত কেজি checked baggage (চেক-ইন করা লাগেজ) — যাদের ব্যাগ নেই তারাও হিসাবে আছে।',tip:'Cabin (হাতের) baggage এখানে নেই।'},
 bagFlight:{name:'প্রতি ফ্লাইট ব্যাগেজ',def:'প্রতি operated flight-এ গড়ে কত কেজি checked baggage।',tip:'এটা গড়, কোনো নির্দিষ্ট flight-এর মোট ওজন নয়।'},
 bagAsk:{name:'প্রতি ASK ব্যাগেজ',def:'অফার করা capacity (ASK)-এর তুলনায় baggage-এর ওজন — শিক্ষামূলক অনুপাত।',tip:'দূরত্ব বাড়লে ASK বাড়ে, তাই এই সংখ্যা কমে যায়।'},
 bagRpk:{name:'প্রতি RPK ব্যাগেজ',def:'যাত্রী traffic (RPK)-এর তুলনায় baggage-এর ওজন।',tip:'এটাকে "প্রতি যাত্রীর গড় ব্যাগ ওজন" ভাববেন না।'},
 mishandled:{name:'ভুলভাবে পরিচালিত ব্যাগের হার',def:'প্রতি ১,০০০ যাত্রীতে কতটি ব্যাগ দেরিতে / হারিয়ে / ক্ষতিগ্রস্ত হয়েছে (delayed + lost + damaged)।',tip:'একটি ব্যাগ দুই ক্যাটাগরিতে গুনবেন না।'},
 delayed:{name:'দেরিতে আসা ব্যাগের হার',def:'প্রতি ১,০০০ যাত্রীতে কতটি ব্যাগ দেরিতে পৌঁছেছে (শেষে হারানো ব্যাগ বাদে)।',tip:'এটা কতবার দেরি হলো তা মাপে, কত সময় দেরি তা নয়।'},
 lost:{name:'হারানো ব্যাগের হার',def:'প্রতি ১,০০০ যাত্রীতে কতটি ব্যাগ চূড়ান্তভাবে হারিয়ে গেছে।',tip:'ছোট sample-এ ০টি হারানো মানে ঝুঁকি শূন্য নয়।'},
 complaints:{name:'অভিযোগের হার',def:'প্রতি ১,০০,০০০ যাত্রীতে কতটি অভিযোগ (complaint) জমা পড়েছে।',tip:'একজন যাত্রী একাধিক অভিযোগ দিতে পারে।'},
 compliments:{name:'প্রশংসার হার',def:'প্রতি ১,০০,০০০ যাত্রীতে কতটি প্রশংসা (compliment) এসেছে।',tip:'অভিযোগ থেকে প্রশংসা বিয়োগ করে "সন্তুষ্টি" বানাবেন না।'},
 profit:{name:'পরিচালন মুনাফা',def:'মোট operating revenue (আয়) − মোট operating cost (খরচ)। বাতিল flight-এর খরচও এখানে ধরা হয়।',tip:'Operating profit ধনাত্মক হলেও net profit বা cash flow ঋণাত্মক হতে পারে।'},
 margin:{name:'পরিচালন মুনাফার মার্জিন',def:'আয়ের কত শতাংশ মুনাফা হিসেবে থেকেছে — profit ÷ revenue × 100।',tip:'বেশি % মার্জিন মানেই বড় অঙ্কের লাভ নয়।'},
 net:{name:'নিট মুনাফা',def:'Operating profit থেকে সুদ (interest) ও কর (tax) বাদ দিয়ে চূড়ান্ত মুনাফা। মাসিক airline-level হিসাব।',tip:'মুনাফা (profit) আর নগদ প্রবাহ (cash flow) এক জিনিস নয়।'},
 ocf:{name:'পরিচালন নগদ প্রবাহ',def:'ব্যবসা চালিয়ে আসলে কত নগদ টাকা এসেছে: Net profit + depreciation (অবচয়, নগদ খরচ নয়) − working capital বৃদ্ধি।',tip:'Depreciation হিসাবের খরচ, কিন্তু এ মাসে টাকা বের হয়নি — তাই আবার যোগ করা হয়।'},
 cashflow:{name:'নিট নগদ প্রবাহ',def:'সব মিলিয়ে নগদ টাকার পরিবর্তন: Operating CF − capex (বিনিয়োগ) + নতুন ঋণ − ঋণ পরিশোধ। Opening cash + net cash flow = closing cash।',tip:'ঋণ নিলে নগদ বাড়ে কিন্তু মুনাফা বাড়ে না।'},
 shortDebt:{name:'স্বল্পমেয়াদি ঋণ',def:'নির্বাচিত শেষ মাসের শেষে ১ বছরের মধ্যে পরিশোধযোগ্য ঋণের স্থিতি (balance)।',tip:'এটা stock (একটি সময়ের স্থিতি) — মাসগুলোর balance যোগ করবেন না, শুধু শেষ মাস নিন।'},
 longDebt:{name:'দীর্ঘমেয়াদি ঋণ',def:'নির্বাচিত শেষ মাসের শেষে ১ বছরের পরে পরিশোধযোগ্য ঋণের স্থিতি।',tip:'মাসিক balance যোগ করা যাবে না; নতুন ঋণ ও পুনঃশ্রেণীকরণ (reclassification) এটা বদলায়।'}
};

/* ---------- Row-level calculation rules for every total in "s" ----------
   f(row, ctx) → {v:number contributed, t:text shown}; v:null = row excluded. */
const n3=v=>Number(v).toLocaleString('en-GB',{maximumFractionDigits:3});
const OP=r=>r.status!=='Cancelled';
const EX=t=>({v:null,t});
const opOnly=fn=>r=>OP(r)?fn(r):EX('Cancelled → বাদ');
const plain=f=>opOnly(r=>({v:Number(r[f])||0,t:n3(r[f]||0)}));
const COMP={
 scheduled:{src:'flights',label:'Scheduled sectors',bn:'নির্ধারিত flight সংখ্যা',rule:'Every scheduled row counts 1 (cancelled included).',fields:['status'],f:r=>({v:1,t:'1'})},
 operated:{src:'flights',label:'Operated sectors',bn:'চালু হওয়া flight সংখ্যা',rule:'Count 1 if status is not "Cancelled".',fields:['status'],f:r=>OP(r)?{v:1,t:'1'}:{v:0,t:'0 (Cancelled)'}},
 cancelled:{src:'flights',label:'Cancelled sectors',bn:'বাতিল flight সংখ্যা',rule:'Count 1 if status is "Cancelled".',fields:['status'],f:r=>r.status==='Cancelled'?{v:1,t:'1'}:{v:0,t:'0'}},
 diverted:{src:'flights',label:'Diverted sectors',bn:'diverted flight সংখ্যা',rule:'Among operated rows, count 1 if status is "Diverted".',fields:['status'],f:opOnly(r=>r.status==='Diverted'?{v:1,t:'1'}:{v:0,t:'0'})},
 ontime:{src:'flights',label:'On-time operated sectors',bn:'সময়মতো পৌঁছানো flight',rule:'Operated, not diverted, and arrival delay < 15 min → 1.',fields:['status','arrival_delay_min'],f:opOnly(r=>r.status==='Diverted'?{v:0,t:'Diverted → 0'}:r.arrival_delay_min<15?{v:1,t:r.arrival_delay_min+' < 15 → 1'}:{v:0,t:r.arrival_delay_min+' ≥ 15 → 0'})},
 delay:{src:'flights',label:'Total non-negative arrival delay (min)',bn:'মোট বিলম্ব (মিনিট)',rule:'For each operated row: max(arrival delay, 0).',fields:['arrival_delay_min'],f:opOnly(r=>{const v=Math.max(0,r.arrival_delay_min);return {v,t:`max(${r.arrival_delay_min}, 0) = ${v}`};})},
 turns:{src:'flights',label:'Observed turnarounds',bn:'মাপা turnaround সংখ্যা',rule:'Count 1 when turnaround_min is recorded.',fields:['turnaround_min'],f:opOnly(r=>r.turnaround_min===null?{v:0,t:'not observed → 0'}:{v:1,t:'1'})},
 turn:{src:'flights',label:'Total turnaround minutes',bn:'মোট turnaround মিনিট',rule:'Add turnaround_min where it is recorded; skip blanks.',fields:['turnaround_min'],f:opOnly(r=>r.turnaround_min===null?EX('not observed → বাদ'):{v:r.turnaround_min,t:n3(r.turnaround_min)})},
 gate:{src:'flights',label:'Departures with gate change',bn:'gate বদলানো flight',rule:'gate_change is 1 if at least one change happened.',fields:['gate_change'],f:plain('gate_change')},
 passengers:{src:'flights',label:'Revenue passengers',bn:'মোট যাত্রী',rule:'Add passengers on operated rows.',fields:['passengers'],f:plain('passengers')},
 rpk:{src:'flights',label:'RPK',bn:'যাত্রী × km',rule:'passengers × distance_km on each operated row.',fields:['passengers','distance_km'],f:opOnly(r=>({v:r.passengers*r.distance_km,t:`${n3(r.passengers)} × ${n3(r.distance_km)} = ${n3(r.passengers*r.distance_km)}`}))},
 ask:{src:'flights',label:'ASK',bn:'আসন × km',rule:'seats × distance_km on each operated row.',fields:['seats','distance_km'],f:opOnly(r=>({v:r.seats*r.distance_km,t:`${n3(r.seats)} × ${n3(r.distance_km)} = ${n3(r.seats*r.distance_km)}`}))},
 ctk:{src:'flights',label:'CTK',bn:'কার্গো টন × km',rule:'cargo_kg ÷ 1,000 × distance_km on each operated row.',fields:['cargo_kg','distance_km'],f:opOnly(r=>{const v=r.cargo_kg/1000*r.distance_km;return {v,t:`${n3(r.cargo_kg)} ÷ 1,000 × ${n3(r.distance_km)} = ${n3(v)}`};})},
 actk:{src:'flights',label:'ACTK',bn:'কার্গো capacity টন × km',rule:'cargo_capacity_kg ÷ 1,000 × distance_km on each operated row.',fields:['cargo_capacity_kg','distance_km'],f:opOnly(r=>{const v=r.cargo_capacity_kg/1000*r.distance_km;return {v,t:`${n3(r.cargo_capacity_kg)} ÷ 1,000 × ${n3(r.distance_km)} = ${n3(v)}`};})},
 bag:{src:'flights',label:'Checked baggage (kg)',bn:'মোট checked baggage (কেজি)',rule:'Add baggage_kg on operated rows.',fields:['baggage_kg'],f:plain('baggage_kg')},
 delayed:{src:'flights',label:'Delayed bags',bn:'দেরিতে আসা ব্যাগ',rule:'Add delayed_bags on operated rows.',fields:['delayed_bags'],f:plain('delayed_bags')},
 lost:{src:'flights',label:'Lost bags',bn:'হারানো ব্যাগ',rule:'Add lost_bags on operated rows.',fields:['lost_bags'],f:plain('lost_bags')},
 damaged:{src:'flights',label:'Damaged bags',bn:'ক্ষতিগ্রস্ত ব্যাগ',rule:'Add damaged_bags on operated rows.',fields:['damaged_bags'],f:plain('damaged_bags')},
 mishandled:{src:'flights',label:'Mishandled bags',bn:'মোট সমস্যাযুক্ত ব্যাগ',rule:'delayed + lost + damaged bags on each operated row.',fields:['delayed_bags','lost_bags','damaged_bags'],f:opOnly(r=>{const v=r.delayed_bags+r.lost_bags+r.damaged_bags;return {v,t:`${r.delayed_bags} + ${r.lost_bags} + ${r.damaged_bags} = ${v}`};})},
 complaints:{src:'flights',label:'Complaints',bn:'অভিযোগ',rule:'Add complaints on operated rows.',fields:['complaints'],f:plain('complaints')},
 compliments:{src:'flights',label:'Compliments',bn:'প্রশংসা',rule:'Add compliments on operated rows.',fields:['compliments'],f:plain('compliments')},
 revenue:{src:'flights',label:'Operating revenue (€)',bn:'মোট পরিচালন আয়',rule:'passenger + ancillary + cargo revenue on every scheduled row.',fields:['passenger_revenue_eur','ancillary_revenue_eur','cargo_revenue_eur'],f:r=>{const v=r.operating_revenue_eur;return {v,t:`${n3(r.passenger_revenue_eur)} + ${n3(r.ancillary_revenue_eur)} + ${n3(r.cargo_revenue_eur)} = ${n3(v)}`};}},
 passengerRevenue:{src:'flights',label:'Passenger revenue (€)',bn:'শুধু যাত্রী ভাড়া আয়',rule:'Add passenger_revenue_eur on every row.',fields:['passenger_revenue_eur'],f:r=>({v:r.passenger_revenue_eur,t:n3(r.passenger_revenue_eur)})},
 cost:{src:'flights',label:'Operating cost (€)',bn:'মোট পরিচালন খরচ',rule:'Add operating_cost_eur on every row (cancellation costs included).',fields:['operating_cost_eur'],f:r=>({v:r.operating_cost_eur,t:n3(r.operating_cost_eur)})},
 profit:{src:'flights',label:'Operating profit (€)',bn:'পরিচালন মুনাফা',rule:'operating revenue − operating cost on every row.',fields:['operating_revenue_eur','operating_cost_eur'],f:r=>{const v=r.operating_revenue_eur-r.operating_cost_eur;return {v,t:`${n3(r.operating_revenue_eur)} − ${n3(r.operating_cost_eur)} = ${n3(v)}`};}},
 block:{src:'aircraftDays',label:'Block hours',bn:'মোট block hours',rule:'Add block_hours for each aircraft-day (idle days = 0).',fields:['aircraft_id','block_hours'],f:r=>({v:r.block_hours,t:n3(r.block_hours)})},
 aircraftDays:{src:'aircraftDays',label:'Aircraft-days',bn:'বিমান-দিন',rule:'Each aircraft on each calendar day = 1.',fields:['aircraft_id','aircraft_days'],f:r=>({v:r.aircraft_days,t:n3(r.aircraft_days)})},
 crewHours:{src:'crewDays',label:'Pilot-person block hours',bn:'মোট pilot ঘণ্টা',rule:'Add pilot_block_hours (2 pilots × flight block hours).',fields:['pilot_block_hours'],f:r=>({v:r.pilot_block_hours,t:n3(r.pilot_block_hours)})},
 crewDays:{src:'crewDays',label:'Pilot-person-days',bn:'pilot-দিন',rule:'Add rostered pilot_person_days.',fields:['pilot_person_days'],f:r=>({v:r.pilot_person_days,t:n3(r.pilot_person_days)})},
 net:{src:'finance',label:'Net profit (€)',bn:'নিট মুনাফা',rule:'Each month: operating profit − interest − tax.',fields:['operating_profit_eur','interest_eur','tax_eur'],f:r=>({v:r.net_profit_eur,t:`${n3(r.operating_profit_eur)} − ${n3(r.interest_eur)} − ${n3(r.tax_eur)} = ${n3(r.net_profit_eur)}`})},
 ocf:{src:'finance',label:'Operating cash flow (€)',bn:'পরিচালন নগদ প্রবাহ',rule:'Each month: net profit + depreciation − increase in working capital.',fields:['net_profit_eur','depreciation_eur','working_capital_increase_eur'],f:r=>({v:r.operating_cashflow_eur,t:`${n3(r.net_profit_eur)} + ${n3(r.depreciation_eur)} − ${n3(r.working_capital_increase_eur)} = ${n3(r.operating_cashflow_eur)}`})},
 cashflow:{src:'finance',label:'Net cash flow (€)',bn:'নিট নগদ প্রবাহ',rule:'Each month: operating CF − capex + new borrowing − debt repayment.',fields:['operating_cashflow_eur','capex_eur','new_borrowing_eur','debt_repayment_eur'],f:r=>({v:r.net_cashflow_eur,t:`${n3(r.operating_cashflow_eur)} − ${n3(r.capex_eur)} + ${n3(r.new_borrowing_eur)} − ${n3(r.debt_repayment_eur)} = ${n3(r.net_cashflow_eur)}`})},
 shortDebt:{src:'finance',label:'Short-term debt (€)',bn:'স্বল্পমেয়াদি ঋণ',rule:'Take only the latest selected month per airline (a balance/stock).',fields:['month','short_debt_eur'],f:(r,c)=>c.latest[r.airline]===r.month?{v:r.short_debt_eur,t:n3(r.short_debt_eur)+' (latest month)'}:EX('earlier month → বাদ')},
 longDebt:{src:'finance',label:'Long-term debt (€)',bn:'দীর্ঘমেয়াদি ঋণ',rule:'Take only the latest selected month per airline (a balance/stock).',fields:['month','long_debt_eur'],f:(r,c)=>c.latest[r.airline]===r.month?{v:r.long_debt_eur,t:n3(r.long_debt_eur)+' (latest month)'}:EX('earlier month → বাদ')}
};
function compContext(rows){const latest={};rows.forEach(r=>{if(r.month!=null&&(!latest[r.airline]||latest[r.airline]<r.month))latest[r.airline]=r.month;});return {latest};}

/* ---------- Small teaching sample (নমুনা ডেটা) — numbers chosen to be easy to follow ---------- */
function mkFlight(o){const f=Object.assign({airline:'SA',operator:'Sample Air',aircraft_id:'SIM-SA-1',aircraft_type:'A320',seats:180,passengers:0,cargo_capacity_kg:0,cargo_kg:0,baggage_kg:0,arrival_delay_min:null,block_min:0,turnaround_min:null,gate_change:0,delayed_bags:0,lost_bags:0,damaged_bags:0,complaints:0,compliments:0,passenger_revenue_eur:0,ancillary_revenue_eur:0,cargo_revenue_eur:0,operating_cost_eur:0,depreciation_eur:0},o);
 const op=f.status!=='Cancelled';f.rpk=op?f.passengers*f.distance_km:0;f.ask=op?f.seats*f.distance_km:0;f.ctk=op?f.cargo_kg/1000*f.distance_km:0;f.actk=op?f.cargo_capacity_kg/1000*f.distance_km:0;f.operating_revenue_eur=f.passenger_revenue_eur+f.ancillary_revenue_eur+f.cargo_revenue_eur;return f;}
const SAMPLE={
 flights:[
  mkFlight({id:'F1',date:'2025-03-01',month:3,origin:'AAA',destination:'BBB',distance_km:1000,status:'Completed',passengers:150,cargo_capacity_kg:2000,cargo_kg:1200,baggage_kg:2400,arrival_delay_min:-5,block_min:120,turnaround_min:40,delayed_bags:1,compliments:1,passenger_revenue_eur:18000,ancillary_revenue_eur:1500,cargo_revenue_eur:1000,operating_cost_eur:17000}),
  mkFlight({id:'F2',date:'2025-03-01',month:3,origin:'BBB',destination:'AAA',distance_km:1000,status:'Completed',passengers:170,cargo_capacity_kg:2000,cargo_kg:1500,baggage_kg:2900,arrival_delay_min:22,block_min:125,turnaround_min:50,gate_change:1,delayed_bags:2,lost_bags:1,complaints:1,passenger_revenue_eur:20000,ancillary_revenue_eur:1800,cargo_revenue_eur:1200,operating_cost_eur:18500}),
  mkFlight({id:'F3',date:'2025-03-02',month:3,origin:'AAA',destination:'CCC',distance_km:2000,status:'Diverted',passengers:160,cargo_capacity_kg:2500,cargo_kg:1000,baggage_kg:3000,arrival_delay_min:95,block_min:260,damaged_bags:1,complaints:2,passenger_revenue_eur:34000,ancillary_revenue_eur:2500,cargo_revenue_eur:1500,operating_cost_eur:39000}),
  mkFlight({id:'F4',date:'2025-03-03',month:3,origin:'CCC',destination:'AAA',distance_km:2000,status:'Cancelled',operating_cost_eur:4000})
 ],
 aircraftDays:[
  {date:'2025-03-01',month:3,airline:'SA',aircraft_id:'SIM-SA-1',aircraft_type:'A320',aircraft_days:1,block_hours:4.0833,operated_sectors:2},
  {date:'2025-03-02',month:3,airline:'SA',aircraft_id:'SIM-SA-1',aircraft_type:'A320',aircraft_days:1,block_hours:4.3333,operated_sectors:1},
  {date:'2025-03-03',month:3,airline:'SA',aircraft_id:'SIM-SA-1',aircraft_type:'A320',aircraft_days:1,block_hours:0,operated_sectors:0}
 ],
 crewDays:[
  {date:'2025-03-01',month:3,airline:'SA',pilot_person_days:4,pilot_block_hours:8.1667},
  {date:'2025-03-02',month:3,airline:'SA',pilot_person_days:4,pilot_block_hours:8.6667},
  {date:'2025-03-03',month:3,airline:'SA',pilot_person_days:4,pilot_block_hours:0}
 ],
 finance:[
  {airline:'SA',month:1,operating_revenue_eur:1000000,operating_cost_eur:900000,operating_profit_eur:100000,depreciation_eur:40000,interest_eur:10000,tax_eur:15000,net_profit_eur:75000,working_capital_increase_eur:5000,operating_cashflow_eur:110000,capex_eur:30000,new_borrowing_eur:0,debt_repayment_eur:20000,net_cashflow_eur:60000,opening_cash_eur:500000,closing_cash_eur:560000,short_debt_eur:800000,long_debt_eur:6000000},
  {airline:'SA',month:2,operating_revenue_eur:1200000,operating_cost_eur:1050000,operating_profit_eur:150000,depreciation_eur:40000,interest_eur:10000,tax_eur:25000,net_profit_eur:115000,working_capital_increase_eur:15000,operating_cashflow_eur:140000,capex_eur:200000,new_borrowing_eur:100000,debt_repayment_eur:20000,net_cashflow_eur:20000,opening_cash_eur:560000,closing_cash_eur:580000,short_debt_eur:780000,long_debt_eur:6100000}
 ]
};

/* ---------- Glossary / শব্দকোষ ---------- */
const GLOSSARY=[
 ['Sector','One flight leg from take-off airport to landing airport.','একটি flight-এর এক অংশ — এক বিমানবন্দর থেকে আরেক বিমানবন্দর পর্যন্ত (যেমন DAC → CGP)।'],
 ['Scheduled flight','A flight planned in the timetable.','সময়সূচিতে পরিকল্পিত flight — চলুক বা বাতিল হোক।'],
 ['Operated flight','A scheduled flight that actually flew (including diverted).','যে flight আসলে উড়েছে (diverted সহ)।'],
 ['Cancelled','Scheduled but did not operate.','নির্ধারিত ছিল কিন্তু ওড়েনি — বাতিল।'],
 ['Diverted','Flew but landed at a different airport than planned.','উড়েছে কিন্তু নির্ধারিত গন্তব্যের বদলে অন্য বিমানবন্দরে নেমেছে।'],
 ['Revenue passenger','A passenger who paid for the ticket (not staff/infant free).','যে যাত্রী টাকা দিয়ে টিকিট কিনেছেন।'],
 ['Capacity','What the airline offers for sale (seats, cargo space).','airline যা বিক্রির জন্য অফার করে — আসন বা কার্গো জায়গা (ধারণক্ষমতা)।'],
 ['Traffic','What is actually sold/used (passengers, cargo carried).','যা আসলে বিক্রি/ব্যবহার হয়েছে — যাত্রী বা কার্গো।'],
 ['RPK','Revenue Passenger Kilometres = passengers × km.','যাত্রী × কিলোমিটার — traffic-এর মাপ।'],
 ['ASK','Available Seat Kilometres = seats × km.','আসন × কিলোমিটার — capacity-র মাপ।'],
 ['CTK / ACTK','Cargo tonne-km (used) / Available cargo tonne-km (offered).','ব্যবহৃত / অফার করা কার্গো টন × কিলোমিটার।'],
 ['Load factor','Traffic ÷ capacity × 100.','ব্যবহৃত অংশ ÷ অফার করা অংশ × ১০০ — কতটা ভরা ছিল।'],
 ['Yield','Passenger revenue per RPK.','প্রতি যাত্রী-কিলোমিটারে আয় — গড় ভাড়ার হার।'],
 ['Unit cost / Unit revenue','Cost or revenue per one unit of output (e.g. per ASK).','প্রতি এক একক উৎপাদনে খরচ বা আয় (যেমন প্রতি ASK)।'],
 ['Numerator','The top number of a fraction (what you count).','ভগ্নাংশের উপরের অংশ (লব) — যা গোনা হচ্ছে।'],
 ['Denominator','The bottom number of a fraction (what you divide by).','ভগ্নাংশের নিচের অংশ (হর) — যা দিয়ে ভাগ করা হচ্ছে।'],
 ['Multiplier','Number to scale the ratio (×100 for %, ×1,000 per 1,000 pax).','অনুপাতকে স্কেল করার সংখ্যা — % এর জন্য ×১০০, প্রতি ১,০০০ যাত্রীর জন্য ×১,০০০।'],
 ['Ratio / Rate','One quantity divided by another.','একটি সংখ্যাকে আরেকটি দিয়ে ভাগ — অনুপাত / হার।'],
 ['Σ (Sigma)','"Sum of" — add up the values for all rows.','"সবগুলোর যোগফল" — সব row-এর মান যোগ করুন।'],
 ['Mean / Average','Total ÷ number of observations.','গড় — মোট ÷ পর্যবেক্ষণের সংখ্যা।'],
 ['Weighted average','An average where bigger items count more (ratio of totals).','ভারযুক্ত গড় — বড় flight-এর প্রভাব বেশি; মোট ÷ মোট দিয়ে পাওয়া যায়।'],
 ['Block hours','Time from leaving the gate (off-block) to arriving at gate (on-block).','gate ছাড়া থেকে gate-এ পৌঁছানো পর্যন্ত মোট সময় (ঘণ্টায়)।'],
 ['Aircraft-day','One aircraft available for one calendar day.','একটি বিমান × একটি দিন = ১ aircraft-day।'],
 ['Pilot-person-day','One pilot rostered for one day.','একজন pilot × একটি দিন = ১ pilot-person-day।'],
 ['Utilisation','How intensively an asset is used (hours per day).','সম্পদ কতটা ব্যবহার হচ্ছে — প্রতিদিন কত ঘণ্টা।'],
 ['Turnaround','Time an aircraft spends on stand between arrival and next departure.','বিমান নামার পর আবার ছাড়ার আগে stand-এ থাকা সময় (যাত্রী নামানো, পরিষ্কার, জ্বালানি ইত্যাদি)।'],
 ['Arrival delay','Actual arrival time minus scheduled arrival time (minutes).','প্রকৃত আগমন সময় − নির্ধারিত আগমন সময় (মিনিটে)।'],
 ['OTP threshold (15 min)','Industry convention: less than 15 min late = on time.','প্রচলিত নিয়ম: ১৫ মিনিটের কম দেরি = সময়মতো।'],
 ['Gate change','Departure gate changed after being assigned.','নির্ধারিত gate পরিবর্তন হওয়া।'],
 ['Belly cargo','Freight carried in the lower hold of a passenger aircraft.','যাত্রীবাহী বিমানের নিচের মালবাহী অংশে বহন করা কার্গো।'],
 ['Tonne','Metric tonne = 1,000 kg.','মেট্রিক টন = ১,০০০ কেজি।'],
 ['Checked baggage','Bags handed in at check-in and carried in the hold.','চেক-ইন কাউন্টারে জমা দেওয়া লাগেজ।'],
 ['Mishandled baggage','Bags delayed, lost or damaged.','দেরিতে আসা, হারানো বা ক্ষতিগ্রস্ত ব্যাগ।'],
 ['Per 1,000 / per 100,000 pax','Rate scaled to a fixed passenger count for easy comparison.','তুলনা সহজ করতে প্রতি ১,০০০ বা ১,০০,০০০ যাত্রীর হিসেবে প্রকাশ।'],
 ['Ancillary revenue','Extra revenue: bags, seats, meals, etc.','টিকিটের বাইরে অতিরিক্ত আয় — ব্যাগ ফি, সিট সিলেকশন, খাবার ইত্যাদি।'],
 ['Operating revenue','All revenue from flying: passenger + ancillary + cargo.','flight পরিচালনা থেকে মোট আয় — যাত্রী + ancillary + কার্গো।'],
 ['Operating cost','Costs of running flights (fuel, crew, fees, maintenance, depreciation).','flight চালানোর খরচ — জ্বালানি, ক্রু, চার্জ, রক্ষণাবেক্ষণ, অবচয়।'],
 ['Operating profit','Operating revenue − operating cost.','পরিচালন আয় − পরিচালন খরচ।'],
 ['Margin','Profit as a % of revenue.','আয়ের শতকরা কত অংশ লাভ।'],
 ['Depreciation','Spreading an asset\'s cost over its life; an expense, not a cash payment.','অবচয় — সম্পদের দাম তার আয়ুষ্কালে ভাগ করে খরচ ধরা; নগদ টাকা বের হয় না।'],
 ['Interest','Cost of borrowing money.','ঋণের সুদ।'],
 ['Tax','Income tax on profit.','মুনাফার উপর কর।'],
 ['Net profit','Profit after interest and tax.','সুদ ও কর বাদ দেওয়ার পর চূড়ান্ত মুনাফা।'],
 ['Working capital','Short-term operating funds (receivables, inventory − payables). An increase ties up cash.','চলতি মূলধন — বাড়লে নগদ টাকা আটকে যায়, তাই cash flow থেকে বিয়োগ হয়।'],
 ['Cash flow','Actual movement of cash in/out in a period.','নির্দিষ্ট সময়ে প্রকৃত নগদ টাকার আসা-যাওয়া।'],
 ['Capex','Capital expenditure — buying long-term assets (aircraft, engines).','মূলধনী ব্যয় — বিমান, ইঞ্জিনের মতো দীর্ঘমেয়াদি সম্পদ কেনা।'],
 ['Borrowing / Repayment','New loans received / loans paid back.','নতুন ঋণ নেওয়া / ঋণ পরিশোধ করা।'],
 ['Opening / Closing cash','Cash at the start / end of the period.','মেয়াদের শুরু / শেষে হাতে থাকা নগদ।'],
 ['Stock vs Flow','Stock = balance at a point in time (debt). Flow = amount over a period (profit).','Stock = একটি নির্দিষ্ট সময়ের স্থিতি (যেমন ঋণ)। Flow = একটি সময়কাল জুড়ে পরিমাণ (যেমন মুনাফা)। Stock যোগ করা যায় না।'],
 ['Short-term / Long-term debt','Debt due within / after 12 months.','১২ মাসের মধ্যে / পরে পরিশোধযোগ্য ঋণ।'],
 ['Reclassification','Moving the part of long-term debt due within a year into short-term debt.','দীর্ঘমেয়াদি ঋণের যে অংশ ১ বছরের মধ্যে দিতে হবে তা স্বল্পমেয়াদিতে সরানো।'],
 ['N/A (Not applicable)','Denominator is zero or data out of scope, so no value exists.','হর শূন্য বা ডেটা প্রযোজ্য নয় — তাই মান নেই (০ নয়)।'],
 ['Synthetic data','Artificially generated data for teaching, not real results.','শিক্ষার জন্য কৃত্রিমভাবে তৈরি ডেটা — বাস্তব ফলাফল নয়।'],
 ['Filter / Scope','Which rows are included in the calculation.','হিসাবে কোন row-গুলো ধরা হবে তা বাছাই।'],
 ['Benchmark','A reference value used for comparison.','তুলনার জন্য একটি মানদণ্ড।']
];

const PRACTICE={
 plf:{q:'RPK rises to 90 million while ASK stays at 100 million. What is PLF (%)?',answer:90,ex:'90 ÷ 100 × 100 = 90%.',tol:.01},
 otp:{q:'Of 200 operated flights, 170 arrive less than 15 minutes late at the intended airport. What is OTP (%)?',answer:85,ex:'170 ÷ 200 × 100 = 85%.',tol:.01},
 cancel:{q:'20 of 1,000 scheduled sectors are cancelled. What is the cancellation rate (%)?',answer:2,ex:'20 ÷ 1,000 × 100 = 2%.',tol:.01},
 cask:{q:'Operating costs are €740,000 and ASK is 10,000,000. What is CASK (€/ASK)?',answer:.074,ex:'740,000 ÷ 10,000,000 = €0.074 per ASK.',tol:.00001},
 clf:{q:'CTK is 600,000 and ACTK is 1,000,000. What is CLF (%)?',answer:60,ex:'600,000 ÷ 1,000,000 × 100 = 60%.',tol:.01},
 margin:{q:'Operating revenue is €1,000,000 and operating cost is €920,000. What is the operating margin (%)?',answer:8,ex:'(1,000,000 − 920,000) ÷ 1,000,000 × 100 = 8%.',tol:.01},
 rpk:{q:'Flight A carries 120 passengers 800 km; flight B carries 150 passengers 1,200 km. What is total RPK?',answer:276000,ex:'120 × 800 = 96,000; 150 × 1,200 = 180,000; 96,000 + 180,000 = 276,000 RPK.',tol:.5},
 ask:{q:'Two flights of a 180-seat aircraft fly 1,500 km each. What is total ASK?',answer:540000,ex:'180 × 1,500 = 270,000 per flight; × 2 = 540,000 ASK.',tol:.5},
 rask:{q:'Operating revenue is €850,000 and ASK is 10,000,000. What is RASK (€/ASK)?',answer:.085,ex:'850,000 ÷ 10,000,000 = €0.085 per ASK.',tol:.00001},
 yield:{q:'Passenger revenue is €630,000 and RPK is 7,000,000. What is yield (€/RPK)?',answer:.09,ex:'630,000 ÷ 7,000,000 = €0.09 per RPK.',tol:.00001},
 ctk:{q:'A flight carries 1,500 kg of cargo over 2,000 km. What is CTK?',answer:3000,ex:'1,500 ÷ 1,000 = 1.5 tonnes; 1.5 × 2,000 = 3,000 tonne-km.',tol:.01},
 delay:{q:'Four operated flights arrive −4, 0, 10 and 30 minutes late. What is the mean arrival delay (min)?',answer:10,ex:'max(−4,0)=0; (0 + 0 + 10 + 30) ÷ 4 = 10 minutes.',tol:.01},
 diversion:{q:'4 of 400 operated sectors are diverted. What is the diversion rate (%)?',answer:1,ex:'4 ÷ 400 × 100 = 1%.',tol:.01},
 turn:{q:'Three observed turnarounds take 38, 42 and 46 minutes; a fourth was not observed. Average turnaround (min)?',answer:42,ex:'(38 + 42 + 46) ÷ 3 = 42 min. The unobserved turn is excluded, not counted as 0.',tol:.01},
 aircraftUtil:{q:'An aircraft flies 300 block hours in a 30-day month. Utilisation (h/aircraft-day)?',answer:10,ex:'300 ÷ 30 = 10 block hours per aircraft-day.',tol:.01},
 bagPax:{q:'50,000 passengers check in 600,000 kg of baggage. Baggage per passenger (kg)?',answer:12,ex:'600,000 ÷ 50,000 = 12 kg per passenger.',tol:.01},
 mishandled:{q:'There are 30 delayed, 5 lost and 15 damaged bags for 10,000 passengers. Mishandled rate per 1,000 pax?',answer:5,ex:'(30 + 5 + 15) ÷ 10,000 × 1,000 = 5 bags per 1,000 passengers.',tol:.01},
 complaints:{q:'There are 45 complaints from 150,000 passengers. Complaint rate per 100,000 pax?',answer:30,ex:'45 ÷ 150,000 × 100,000 = 30 per 100,000 passengers.',tol:.01},
 profit:{q:'Revenue is €2,400,000 and operating cost is €2,250,000. Operating profit (€)?',answer:150000,ex:'2,400,000 − 2,250,000 = €150,000.',tol:.5},
 net:{q:'Operating profit €150,000, interest €20,000, tax €30,000. Net profit (€)?',answer:100000,ex:'150,000 − 20,000 − 30,000 = €100,000.',tol:.5},
 ocf:{q:'Net profit €100,000, depreciation €50,000, working capital increase €10,000. Operating cash flow (€)?',answer:140000,ex:'100,000 + 50,000 − 10,000 = €140,000.',tol:.5},
 cashflow:{q:'Operating CF €140,000, capex €200,000, new borrowing €100,000, repayment €25,000. Net cash flow (€)?',answer:15000,ex:'140,000 − 200,000 + 100,000 − 25,000 = €15,000.',tol:.5}
};
if(typeof module!=='undefined')module.exports={KPIS,aggregate,PRACTICE,BN,COMP,SAMPLE,GLOSSARY,compContext};
