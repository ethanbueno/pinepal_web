import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useAppDownloadUrl } from "../hooks/useAppDownloadUrl"
import HomeCarousel from "../components/HomeCarousel"
import LearnMore from "../components/LearnMore"
import DiseaseTiles from "../components/DiseaseTiles"
import FarmerHome from "./FarmerHome"
import rowsPhoto from "../assets/auth/farm-pineapple-rows.jpg"
import mistyPhoto from "../assets/auth/farm-misty-field.jpg"
import handpickedPhoto from "../assets/auth/farm-handpicked.jpg"
import sunlitPhoto from "../assets/auth/farm-sunlit-rows.jpg"
import logo from "../assets/pinepal-logo.png"

const scrollTo = (id) => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
}

// Farmer Home, laid out like a product site: a sliding banner across the top, "Learn more"
// opening how PinePal works right under it, photo tiles for what it recognises (each opens
// its guide), and the farmer's own farm below (FarmerHome, once the My Farm page).
function FarmerWelcome() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const downloadUrl = useAppDownloadUrl()
  const firstName = user.full_name?.split(" ")[0] || user.username
  const [learnMore, setLearnMore] = useState(false)

  const slides = [
    {
      image: rowsPhoto,
      eyebrow: `Welcome, ${firstName}`,
      eyebrowIcon: logo,
      title: "Catch pineapple diseases early",
      highlight: "early",
      text: "Scan a fruit and get the diagnosis and what to do next in seconds.",
      action: { label: learnMore ? "Show less" : "Learn more", onClick: () => setLearnMore((open) => !open) },
    },
    {
      image: mistyPhoto,
      eyebrow: "In the field",
      title: "Works even without signal",
      highlight: "without signal",
      text: "Scan offline on your phone. Results upload by themselves when you're back online.",
      action: { label: "Get the mobile app", href: downloadUrl },
    },
    {
      image: handpickedPhoto,
      eyebrow: "Treatment",
      title: "Know what to do next",
      highlight: "what to do",
      text: "Step-by-step treatment and prevention for every disease PinePal finds.",
      action: { label: "Read the guides", onClick: () => navigate("/guides") },
    },
    {
      image: sunlitPhoto,
      eyebrow: "Your farm",
      title: "Your farm at a glance",
      highlight: "at a glance",
      text: "Scan totals, a map of where you scanned, and your latest results.",
      action: { label: "See my farm", onClick: () => scrollTo("my-farm") },
    },
  ]

  return (
    <div className="space-y-8 pb-6">
      <div>
        <HomeCarousel slides={slides} label="PinePal highlights" />
        <LearnMore id="learn-more" open={learnMore} />
      </div>

      <DiseaseTiles />

      <div id="my-farm" className="scroll-mt-6">
        <FarmerHome />
      </div>
    </div>
  )
}

export default FarmerWelcome
