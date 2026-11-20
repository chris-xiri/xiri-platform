---
title: "Open-Source BMS vs. Johnson Controls, Honeywell & Siemens: How LoRaWAN Gateways & Sensors Replace $100K Building Automation"
description: "Comparing open-source BMS (VOLTTRON, OpenBMS, Project Haystack) and LoRaWAN gateway + wireless sensor networks against Johnson Controls (Metasys), Honeywell (Niagara N4), Siemens (Desigo), and Schneider Electric (EcoStruxure)."
publishDate: "2025-10-28"
readTime: "12 min"
category: "Operations"
author: "XIRI Facility Solutions"
lastUpdated: "2026-11-20"
---

## What Is Open-Source BMS (and Why Are Building Owners Rebelling Against the "Big 4")?

An open-source building management system (BMS) is free, non-proprietary software that monitors and controls building mechanical systems — primarily HVAC, lighting, water leak detection, energy sub-metering, and indoor air quality (IAQ) — without the recurring software licensing fees or dealer lock-in of the **"Big 4" enterprise BMS giants: Johnson Controls (Metasys), Honeywell (Tridium Niagara N4 / ComfortPoint), Siemens (Desigo CC), and Schneider Electric (EcoStruxure)**.

Even more importantly in 2026, building owners are combining open-source BMS software with **915 MHz LoRaWAN (Long Range Wide Area Network) hubs/gateways and 10-year battery wireless sensors**. Why? Because in a traditional Johnson Controls or Siemens BMS installation, **60% of the cost isn't the software — it's paying union low-voltage electricians $180+/hour to pull conduit and RS-485 BACnet MSTP wire through concrete walls and ceilings**.

A single **LoRaWAN indoor gateway/hub ($250–$600)** penetrates steel, concrete, and 10+ floors to connect **50 to 500+ peel-and-stick wireless LoRaWAN sensors** (temperature, humidity, $CO_2$, HVAC supply/return differential pressure, compressor Room water-leak ropes, and smart restroom occupancy/soap counters) — bridging directly into **BACnet IP, MQTT, VOLTTRON, or Home Assistant** with **zero conduit, zero IT Wi-Fi congestion, and zero vendor lock-in**.

## Head-to-Head: Open-Source BMS + LoRaWAN vs. Johnson Controls, Honeywell, Siemens & Schneider Electric

Here is how open-source building automation and LoRaWAN sensor networks compare directly against the major proprietary BMS platforms on the market today:

| System / Platform | Primary Architecture & Protocol | Upfront Cost (15K–50K sq ft) | Annual Licensing / Maintenance | Technician Hourly Rate & Lock-In | Best Fit |
|-------------------|---------------------------------|:----------------------------:|:------------------------------:|----------------------------------|----------|
| **Johnson Controls (Metasys / Facility Explorer)** | Hardwired BACnet IP/MSTP; proprietary Metasys UI & SCT programming tools | $65,000–$220,000 | $8,000–$25,000/yr | **$240–$350/hr** (High lock-in on Metasys branch offices; FX is more open via Niagara) | Hospitals, 100K+ sq ft campuses, stadiums |
| **Honeywell (Tridium Niagara N4 / WEBs)** | Niagara Framework (Hardwired BACnet, Modbus, LonWorks) | $45,000–$175,000 | $5,000–$18,000/yr (SMA + JACE point licenses) | **$185–$290/hr** (Medium lock-in — must ensure your integrator hands over the Niagara Station admin credentials & NIC statement) | Mid-to-large commercial buildings (30K–150K sq ft) |
| **Siemens (Desigo CC / Talon)** | Hardwired BACnet; proprietary Desigo engineering & dongle licensing | $70,000–$250,000 | $10,000–$28,000/yr | **$250–$360/hr** (Very high lock-in; restricted to Siemens branch or select VAPs) | Pharma, ISO cleanrooms, university campuses |
| **Schneider Electric (EcoStruxure / Andover / TAC)** | Hardwired BACnet / SmartX IP controllers | $55,000–$200,000 | $6,000–$20,000/yr | **$210–$320/hr** (High lock-in to authorized EcoXperts) | Data centers, corporate headquarters |
| **Automated Logic / Carrier (WebCTRL)** | Native hardwired BACnet; thermographic floor plans | $50,000–$180,000 | $5,000–$16,000/yr | **$195–$300/hr** (Medium-high dealer lock-in) | K-12 schools, municipal buildings, medical parks |
| **Open-Source BMS (DOE VOLTTRON / OpenBMS + Hardwired BACnet)** | Open Python agents; native BACnet, Modbus, Project Haystack tagging | $13,000–$80,000 (Heavy low-voltage wiring cost) | $0 license ($2,000–$12,000/yr server/IT support) | **$0 software lock-in** (Requires Linux/Python/BACnet engineer at $150–$220/hr) | Tech-savvy portfolio owners, DOE/university labs |
| **LoRaWAN Hub + Wireless Sensors + XIRI Managed Facility Stack** | **915 MHz LoRaWAN Gateway (Milesight/Dragino/RAK)** → MQTT/BACnet IP + Smart Thermostats + **NFC & GP PRO IoT** | **$1,500–$7,500** (Zero conduit; peel-and-stick 10-yr battery sensors) | $10,000–$36,000/yr (**includes actual HVAC filter PM, janitorial & repairs**) | **$0 lock-in** (Open payload decoders; XIRI dispatches the actual technicians & cleaners) | Medical offices, dental practices, labs, retail & 5K–75K sq ft buildings |

## The Game-Changer: How a LoRaWAN Hub & Wireless Sensors Eliminate 80% of BMS Installation Cost

If you ask Johnson Controls, Honeywell, or Siemens to add 25 temperature, humidity, leak, and filter-pressure points to an existing 20,000 sq ft medical or commercial building, they will quote you **$35,000 to $75,000** — because their crew has to open drop ceilings, core through firestops, pull shielded twisted-pair RS-485 wire back to a JACE or Metasys controller, and charge per BACnet point license.

With a **LoRaWAN Building Sensor Network**, the architecture is radically simpler and 100% open:

### 1. The LoRaWAN Gateway / Hub + The Things Network (TTN)
Unlike Wi-Fi or Zigbee/Bluetooth (which struggle through concrete walls and require your client's corporate IT department to open firewall ports), **LoRaWAN operates on sub-gigahertz 915 MHz (US915) radio frequencies**.
- **Single-Hub Coverage:** One commercial indoor LoRaWAN gateway — such as a **Milesight UG65 / UG67**, **RAKwireless WisGate Edge**, **Dragino LPS8v2**, **The Things Indoor Gateway (TTIG)**, or **MultiTech Conduit** ($100–$650) — covers up to **50,000–100,000+ sq ft across multiple concrete floors** and supports up to **2,000 wireless sensors**.
- **The Things Network (TTN), The Things Stack (TTS) & ChirpStack:** Your LoRaWAN gateway connects directly to **The Things Network (TTN)** — the global open-source LoRaWAN network infrastructure — or runs a self-hosted **The Things Stack / ChirpStack** LNS (LoRaWAN Network Server). Using TTN's open payload formatters and webhooks, sensor alerts route straight to **SMS text, Slack, email, MQTT, BACnet/IP, VOLTTRON, or Home Assistant** with **$0 proprietary BMS licensing**.
- **LTE Cellular Backhaul:** By putting a $10/month cellular SIM inside the LoRaWAN hub, the entire building sensor network stays **100% air-gapped from the tenant's HIPAA/PCI corporate Wi-Fi network**.

### 2. Why Commercial Water Leak Detection Is the #1 ROI Use Case for LoRaWAN (Especially in Dental, Medical & Multi-Tenant Buildings)
If you only deploy one type of LoRaWAN sensor in a commercial building, medical clinic, or dental practice, make it **LoRaWAN Water Leak Sensors (Spot Probes, Conductive Rope Cables & Automatic Shutoff Valves)**.

Why? Because in commercial real estate and clinical practices, **water damage is the #1 property insurance claim — and 80% of catastrophic floods happen after 7:00 PM or over a weekend**:
1. **Dental Office Solenoid, Amalgam & Ultrasonic Floods:** A pin-hole burst in a braided water supply line behind a **12-o'clock operatory cabinet**, a stuck float switch in a **dental vacuum/compressor closet**, a leaking **Midmark autoclave reservoir**, or a backed-up **sterilization room / plaster trap sink** on a Saturday night will flood $150,000+ of medical LVT flooring, drywall, and downstairs tenant ceilings by Monday at 7:00 AM.
2. **Ceiling HVAC Condensate Pan Overflows:** Blocked condensate drains on ceiling air handlers or rooftop units overflow silently above acoustic ceiling tiles until the wet tile collapses onto a waiting room or server rack.
3. **Automatic LoRaWAN Ball-Valve Water Shutoff (Class A/C Actuation):** When a $65 **Dragino LWL02** or **Milesight EM300-SLD / EM300-ZLD** leak sensor placed under an operatory sink or water heater detects moisture, **The Things Network / local gateway** not only texts the building owner and XIRI's 24/7 dispatch desk in 3 seconds — it can automatically trigger a **LoRaWAN motorized brass ball valve (Milesight UC100/valve controller or Dragino/Strerega motorized shutoff valve)** on the suite's main domestic water line, stopping the flood before a single gallon escapes.
4. **Commercial Insurance Premium Discounts:** Many commercial property and dental malpractice/business-owner policy (BOP) carriers offer **5–15% premium credits or lower water-damage deductibles** when a documented 24/7 commercial leak-detection and auto-shutoff system is installed.

### 3. The 10 Commercial LoRaWAN Sensors Every Building & Clinical Suite Should Deploy

Because LoRaWAN sensors transmit tiny encrypted data packets every 5–15 minutes, they run for **5 to 10 years on a single lithium-thionyl chloride ($Li-SOCl_2$) AA or coin battery**. Our field teams mount and commission these in minutes:

| LoRaWAN Sensor Type | Typical Hardware (Milesight / Dragino / Elsys / Decentlab) | Unit Cost | What Failure It Prevents in Your Building |
|---------------------|------------------------------------------------------------|:---------:|-------------------------------------------|
| **1. Spot & Rope Water Leak Sensor** | Milesight EM300-SLD / Dragino LWL02 | $65–$130 | Placed under **HVAC condensate pans, hot water heaters, dental vacuum/compressor closets, and sterilization sinks** — texts an alert the second a drip starts before a weekend flood ruins $50K of drywall and flooring |
| **2. Temperature & Relative Humidity (TH) Sensor** | Milesight EM300-TH / Elsys ERS | $65–$110 | Monitors **operatory, cleanroom, pharmacy refrigerator, bank vault, and server closet micro-climates** (alerts if weekend HVAC fails or humidity exceeds 60% mold threshold) |
| **3. $CO_2$, TVOC & PM2.5 Indoor Air Quality (IAQ) Sensor** | Milesight AM103 / AM308 / Elsys ERS CO2 | $140–$260 | Tracks ventilation air-change adequacy, VOC chemical off-gassing (NYS Part 226), and waiting room stuffiness |
| **4. HVAC Supply/Return Duct Pipe Probe Sensor** | Dragino LHT65N (with external DS18B20 probe) | $55–$90 | Strapped directly onto **rooftop unit (RTU) supply and return ducts** — measures $\Delta T$ (temperature split) to detect failing compressor stages or frozen coils *before* tenants complain |
| **5. Differential Air Pressure Sensor (Filter & Cleanroom)** | Milesight EM500-PP / Decentlab DL-PRS | $180–$320 | Measures static pressure drop across **MERV-13/HEPA HVAC filter banks** (telling XIRI the exact day a filter is loaded) and verifies positive/negative pressure in **ISO 7/8 cleanrooms and surgical suites** |
| **6. Clamp-On CT Electrical Sub-Meter (3-Phase Amp Sensor)** | Milesight EM500-CT / Pressac | $150–$250 | Clips around electrical panel feeds for **RTUs, dental air compressors, or vacuum pumps** — detects if heavy equipment was accidentally left running overnight or is drawing high locked-rotor amps |
| **7. Restroom Traffic & Door / People Counter** | Milesight VS330 / VS133 / Dragino LDS02 | $75–$190 | Counts exact restroom entries — triggering **demand-based day porter cleaning and Georgia-Pacific soap/paper restocking** after 100 visits instead of guessing |
| **8. Smart Restroom Fill-Level & Odor ($NH_3 / H_2S$) Sensor** | MilesightGS301 / Trash Bin ToF Ultrasonic | $110–$180 | Detects ammonia/hydrogen sulfide sewer-trap odors (signaling dry floor drains needing bio-enzymatic dosing) and overflowing paper-towel trash bins |
| **9. LoRaWAN BACnet Smart Thermostat / RTU Controller** | Milesight WT201 / Pelican Wireless | $180–$320 | Replaces dumb wall thermostats on packaged RTUs — enabling remote 7-day setback schedules, keypad lockout (so staff don't set AC to 62°F), and open LoRaWAN remote control |
| **10. Door/Window Contact & Mechanical Closet Intrusion Sensor** | Dragino LDS02 / Milesight EM300-MCS | $35–$65 | Logs exactly when mechanical rooms, roof hatches, bank vaults, or biohazard storage closets are opened and alerts if a roof door is propped open |

## The Real Cost Breakdown: LoRaWAN + Open-Source BMS vs. Wired Enterprise BMS

### Option A: The LoRaWAN Wireless Sensor + Hub Stack (10,000–25,000 sq ft Building)

| Component | Cost Per Unit | Quantity | Total |
|-----------|:------------:|:--------:|:-----:|
| **Commercial LoRaWAN Gateway Hub** (Milesight UG65 / RAK WisGate + LTE backup) | $350–$600 | 1 | $350–$600 |
| **LoRaWAN Smart Thermostats** (WT201 for packaged RTUs) | $190–$280 | 2–5 | $380–$1,400 |
| **LoRaWAN Water Leak Sensors** (Mechanical room, HVAC condensate pans, sinks) | $75–$120 | 4–8 | $300–$960 |
| **LoRaWAN Temp / Humidity / IAQ Sensors** (Zones + Supply Duct $\Delta T$ probes) | $65–$160 | 6–12 | $390–$1,920 |
| **LoRaWAN Restroom Traffic & Door Contact Sensors** | $45–$120 | 2–6 | $90–$720 |
| **Field Mounting, QR Commissioning & Alert Dashboard Setup** | — | 1 day (Zero conduit!) | $750–$2,000 |
| **Total Turn-Key LoRaWAN Hardware + Commissioning** | | | **$2,260–$7,600** |

### Option B: Traditional Hardwired BMS (Open-Source VOLTTRON or Big 4 JCI/Honeywell)

| Building Size | LoRaWAN Hub + Wireless Sensors | Open-Source Wired BMS (VOLTTRON + BACnet Wiring) | Big 4 Enterprise BMS (JCI / Honeywell / Siemens) |
|:------------:|:------------------------------:|:------------------------------------------------:|:------------------------------------------------:|
| **10,000 sq ft** | **$2,200–$4,800** | $13,000–$66,000 | $45,000–$110,000 |
| **25,000 sq ft** | **$4,500–$8,500** | $23,000–$110,000 | $85,000–$190,000 |
| **50,000 sq ft** | **$7,500–$15,000** | $40,000–$160,000 | $140,000–$320,000+ |

## Why Building Owners Get Burned by Johnson Controls, Siemens & Honeywell

Even when a building installs an "open protocol" **BACnet** system from Johnson Controls, Siemens, or Honeywell, building owners quickly learn a painful industry secret: **"Open protocol" does not mean "open access."**

1. **The Proprietary Programming Tool Trap:** While the thermostats and VAV controllers speak BACnet, the software required to program sequences of operation — like Johnson Controls' **System Configuration Tool (SCT)** or Siemens' **ABT Site / Desigo engineering tools** — is strictly licensed to authorized factory branches or select dealers.
2. **Tridium Niagara N4 JACE Licensing & NIC Lock-In:** Honeywell's Tridium Niagara N4 is the most common multi-vendor framework, but if your installing contractor locks their **Niagara Interoperability Compatibility (NIC)** certificate or refuses to give you the `admin` credentials to the **JACE 8000 / 9000 controller**, you are still locked into that single vendor.
3. **Alarms Without Execution Are Useless:** A $120,000 Johnson Controls Metasys dashboard can tell you that RTU-2 has a dirty filter or that a restroom sink is leaking — **but it won't send someone to change the filter, vac up the water, mop the floors, or restock the soap dispensers.**

## How XIRI Combines LoRaWAN IoT Hardware With Verified Physical Execution

Most facility companies only know how to push a mop, and most BMS integrators only know how to sell $100,000 software packages. **XIRI bridges both worlds:**
- **Proven Enterprise IoT Field Execution:** XIRI recently executed the field deployment of **Georgia-Pacific's (GP PRO) connected IoT soap dispensing hardware at UBS Arena** in Elmont, NY. Our technicians know how to mount, laser-level, pair, and commission commercial gateways and wireless sensors across occupied facilities without disrupting operations.
- **LoRaWAN Sensors Trigger Real-World XIRI Action:** When a LoRaWAN differential pressure sensor flags a loaded MERV-13 filter, a condensate pan sensor detects a drip, or a restroom counter hits its traffic threshold, **XIRI's own managed HVAC, handyman, and nightly NFC-verified janitorial teams are already under contract to fix it** — all under one predictable monthly invoice.

## Frequently Asked Questions

### How does a LoRaWAN gateway and sensor network compare to Johnson Controls Metasys or Honeywell Niagara?

A **LoRaWAN building sensor network** uses a single 915 MHz wireless hub ($350–$600) and 10-year battery wireless sensors ($45–$250 each) to monitor HVAC supply/return temperatures, room humidity, $CO_2$, water leaks, filter differential pressure, and restroom traffic for **$2,200 to $8,500 installed** — eliminating the $30,000–$150,000 low-voltage conduit wiring and proprietary software licensing charged by **Johnson Controls (Metasys)**, **Honeywell (Niagara N4)**, **Siemens (Desigo)**, and **Schneider Electric (EcoStruxure)**. Furthermore, LoRaWAN hubs output open **MQTT and BACnet/IP**, meaning your data can feed into open-source BMS platforms (VOLTTRON, Home Assistant) or existing BMS head-ends with zero vendor lock-in.

### Will LoRaWAN sensors interfere with our medical office, dental CBCT, or corporate Wi-Fi network?

No. Unlike Wi-Fi (2.4 GHz / 5 GHz) or Bluetooth/Zigbee, **LoRaWAN operates in the unlicensed 915 MHz sub-gigahertz band** in North America and transmits micro-burst packets less than 1% of the time. It penetrates concrete walls and steel mechanical room doors effortlessly, causes zero interference with medical/dental imaging or Wi-Fi networks, and — when paired with an LTE cellular LoRaWAN gateway — stays 100% isolated from your internal HIPAA or corporate LAN.

### What is The Things Network (TTN) / ChirpStack and how does it work with VOLTTRON & LoRaWAN water leak sensors?

**The Things Network (TTN)** (and **The Things Stack / ChirpStack**) is the open-source LoRaWAN Network Server (LNS) layer that sits between your 915 MHz wireless building sensors and your alerts or BMS dashboard. When a **LoRaWAN water leak sensor** (under a dental vacuum closet, sterilization sink, or HVAC condensate pan) detects moisture, it transmits an encrypted 915 MHz packet to your indoor LoRaWAN hub. The Things Network / ChirpStack decodes the payload in milliseconds, fires an instant SMS/email webhook to the building owner and XIRI's dispatch team, and can even send a downlink command to a **LoRaWAN motorized water shutoff valve** to close the main water supply before a flood occurs. Because TTN and ChirpStack publish standard **MQTT and BACnet/IP**, they also integrate natively with **DOE VOLTTRON** and **Home Assistant**.

### Can XIRI install LoRaWAN sensors, smart dispensers, and manage our facility maintenance?

Yes. Across **Nassau County, Suffolk County, and Queens, NY**, XIRI deploys and maintains smart facility hardware — from **Georgia-Pacific connected IoT restroom dispensers** (proven at **UBS Arena**) to **LoRaWAN water-leak, HVAC $\Delta T$, and clinic temperature/humidity sensors** — paired with our nightly NFC-verified janitorial, dental/medical terminal cleaning, and quarterly HVAC preventive maintenance under one consolidated monthly invoice.

[**Get a Free Facility & Smart Sensor Walkthrough →**](/solutions/iot-restroom-dispenser-installation)
