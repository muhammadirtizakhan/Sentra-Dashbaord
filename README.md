<div align="center">
  
## 🛡️ SENTRA Dashboard

🚶 🚗 🚌 AI-Powered CCTV Monitoring & Incident Management

---------------------------------------------------------------------

 <p>
📹 🎥SENTRA is an AI-powered CCTV analysis system that processes video footage, tracks detected objects, and turns relevant activity into reviewable events.
The Python software performs video analysis, while the SENTRA Dashboard brings events, alerts, recordings, and evidence together in one workspace for review.</p>
 
<div/>

<p align="center">
  <img src="https://res.cloudinary.com/djaonuvzx/image/upload/v1793833033/SENTRA_AI_CCTV_monitoring_dashboard_kikuzr.png" alt="SENTRA Dashboard Preview" width="100%"/>
</p>


<div align="center">
  
**A product by [Nexora Solvex](https://nexora-five-topaz.vercel.app/)**

<img src="https://res.cloudinary.com/djaonuvzx/image/upload/v1790244415/ChatGPT_Image_Sep_24_2026_03_06_36_PM_qgkrhw.png" alt="Nexora Solvex Logo" width="200"/>

<br/>

**We don't just build websites — we build complete digital systems.**

Nexora Solvex is a modern AI-focused startup based in Karachi, Pakistan, dedicated to transforming local businesses through scalable digital infrastructures, intelligent chatbot systems, and AI-assisted automation workflows.


<br/>

[![Website](https://img.shields.io/badge/🌐_Website-nexora.vercel.app-7c3aed?style=for-the-badge&logoColor=white)](https://nexora-five-topaz.vercel.app/)
[![Careers](https://img.shields.io/badge/💼_Careers-Join_Us-4f46e5?style=for-the-badge&logoColor=white)](https://nexora-job-portal.vercel.app)
[![Instagram](https://img.shields.io/badge/Instagram-nexora.devx-e1306c?style=for-the-badge&logo=instagram&logoColor=white)](https://www.instagram.com/nexora.devx)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-+92_315_1196495-25D366?style=for-the-badge&logo=whatsapp&logoColor=white)](https://wa.me/923151196495)

<br/>

<div/>

## ⚡ SENTRA Technology Stack

<table border="3" bordercolor="#365F8D" rules="all" frame="box" cellpadding="12" cellspacing="0">
<thead>
<tr bgcolor="#DCEBFF">
<th align="left">SYSTEM</th>
<th align="left">TECHNOLOGIES</th>
<th align="left">ROLE IN SENTRA</th>
</tr>
</thead>
<tbody>
<tr bgcolor="#F4F8FD">
<td><strong>🧠 AI Video Engine</strong><br/><sub>Python software</sub></td>
<td><img src="https://img.shields.io/badge/Python-3776AB?style=flat-square&amp;logo=python&amp;logoColor=white"/> <img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=flat-square&amp;logo=opencv&amp;logoColor=white"/> <img src="https://img.shields.io/badge/Ultralytics%20YOLO-111F68?style=flat-square"/></td>
<td>Analyzes CCTV footage and detects objects and activity.</td>
</tr>
<tr bgcolor="#E8F0FA">
<td><strong>🎯 Object Tracking</strong><br/><sub>Detection pipeline</sub></td>
<td><img src="https://img.shields.io/badge/BoT--SORT-7B2CBF?style=flat-square"/> <img src="https://img.shields.io/badge/Custom%20Tracker-Python-3776AB?style=flat-square&amp;logo=python&amp;logoColor=white"/></td>
<td>Tracks detected objects across video frames and evaluates activity.</td>
</tr>
<tr bgcolor="#F4F8FD">
<td><strong>🖥️ Local App Interface</strong><br/><sub>Operator workspace</sub></td>
<td><img src="https://img.shields.io/badge/NiceGUI-00A98F?style=flat-square"/></td>
<td>Lets operators run CCTV analysis and review results locally.</td>
</tr>
<tr bgcolor="#E8F0FA">
<td><strong>🗄️ Data Layer</strong><br/><sub>Local and cloud data</sub></td>
<td><img src="https://img.shields.io/badge/SQLite-003B57?style=flat-square&amp;logo=sqlite&amp;logoColor=white"/> <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&amp;logo=supabase&amp;logoColor=white"/></td>
<td>Stores application data locally and syncs supported records to the cloud.</td>
</tr>
<tr bgcolor="#F4F8FD">
<td><strong>🎞️ Recording Storage</strong><br/><sub>Private media workflow</sub></td>
<td><img src="https://img.shields.io/badge/Google%20Drive%20API-4285F4?style=flat-square&amp;logo=googledrive&amp;logoColor=white"/> <img src="https://img.shields.io/badge/Supabase%20Storage-3FCF8E?style=flat-square&amp;logo=supabase&amp;logoColor=white"/></td>
<td>Supports cloud-connected recording and evidence storage.</td>
</tr>
<tr bgcolor="#E8F0FA">
<td><strong>📊 Web Dashboard</strong><br/><sub>Online event review</sub></td>
<td><img src="https://img.shields.io/badge/Next.js-000000?style=flat-square&amp;logo=nextdotjs&amp;logoColor=white"/> <img src="https://img.shields.io/badge/React-20232A?style=flat-square&amp;logo=react&amp;logoColor=61DAFB"/> <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&amp;logo=javascript&amp;logoColor=000000"/> <img src="https://img.shields.io/badge/Express-000000?style=flat-square&amp;logo=express&amp;logoColor=white"/> <img src="https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&amp;logo=supabase&amp;logoColor=white"/> <img src="https://img.shields.io/badge/Vercel-000000?style=flat-square&amp;logo=vercel&amp;logoColor=white"/></td>
<td>Displays CCTV events, alerts, recordings, and review information online.</td>
</tr>
</tbody>
</table>


## 📝Request Access

🛡️Visit the SENTRA Dashboard and submit an access request. Then wait for an email containing your access code from the company administrator or product owner.

 [visit dashboard](https://sentra-dashboard-three.vercel.app/)
 
[![Request access to SENTRA](https://res.cloudinary.com/djaonuvzx/image/upload/v1793833702/SENTRA_AI_dashboard_access_banner_ttobmb.png)](https://sentra-dashboard-three.vercel.app/)

--------------------------------


## 🏗️ Architecture at a Glance

------------------

- 🎥 **Video input:** SENTRA accepts footage from a CCTV/IP camera or a video file. OpenCV reads the video frames and timestamps for analysis.

- 🧠 **AI analysis:** The local Python application uses YOLO to detect objects, then BoT-SORT and a custom tracker to follow them across frames. The event rules engine evaluates tracked activity and creates reviewable events, alerts, and evidence.

- 🖥️ **Local software:** The NiceGUI interface lets the operator start and monitor analysis. SQLite keeps local records, while the Supabase adapter syncs supported data to the cloud.

- ☁️ **Cloud data and media:** Supabase stores application records and evidence. Private recordings can use the configured Google Drive integration for storage and playback.

- 📊 **Web applications:** The Next.js/React user dashboard displays events, alerts, recordings, and evidence. The separate admin panel supports user, invitation, and access-request management.

- 🔔 **Push notifications:** New eligible alerts enter the Supabase push queue. The Node.js worker sends Web Push notifications, which the browser’s service worker displays to subscribed users.


![SENTRA Comprehensive System Architecture](https://res.cloudinary.com/djaonuvzx/image/upload/v1793834878/sentra-comprehensive-architecture_pjashr.png)


</div>

-------------------------------------------------------------

## 🌐live demo

Visit the dashbaord by this below clickable tag .built with  💗 by NexoraSolvex


[![Live Demo](https://img.shields.io/badge/🚀_Live_Demo-Built_by_Nexora_Solvex-2563EB?style=for-the-badge)](https://sentra-dashboard-three.vercel.app/)


<div align="center">

<img src="https://res.cloudinary.com/djaonuvzx/image/upload/v1790244415/ChatGPT_Image_Sep_24_2026_03_06_36_PM_qgkrhw.png" width="200"/>

<br/>

<sub>© 2026 Nexora Solvex · Karachi, Pakistan 🇵🇰</sub>

<sub>Building Practical AI-Powered Digital Systems Through Scalable Engineering & Modern Automation</sub>

</div>

