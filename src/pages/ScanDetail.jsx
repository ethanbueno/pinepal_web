import { useEffect, useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { Trash2Icon } from "lucide-react"
import { getScan, verifyScan, deleteScan } from "../api/scans"
import { getProtocols } from "../api/protocols"
import { getMyFarmer } from "../api/farmers"
import { useAuth } from "../context/AuthContext"
import { useToast } from "../components/toastcontext"
import DiseaseBadge from "../components/DiseaseBadge"
import ProtocolCard from "../components/ProtocolCard"
import BackButton from "../components/BackButton"
import ConfirmModal from "../components/ConfirmModal"
import MiniMap from "../components/MiniMap"
import ErrorAlert from "../components/ErrorAlert"
import PageHeader from "../components/PageHeader"
import LoadingBlocks from "../components/LoadingBlocks"
import ConfidenceBar from "../components/ConfidenceBar"
import SelectField from "../components/SelectField"
import { DISEASES, getDisease } from "../utils/diseases"
import { formatDate, formatDateTime, formatPercent, placeholderImage, scanImage } from "../utils/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

const diseaseOptions = DISEASES.map((d) => ({ value: d.label, label: d.name }))

function Info({ label, children }) {
  return (
    <div>
      <div className="mb-0.5 text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{children}</div>
    </div>
  )
}

// Where the "back" button goes, based on the page the user came from.
function getBack(from, isFarmer) {
  if (isFarmer) return { to: "/my-scans", label: "Back to my scans" }
  if (from === "/") return { to: "/", label: "Back to dashboard" }
  if (from === "/map") return { to: "/map", label: "Back to map" }
  if (from?.startsWith("/farmers/")) return { to: from, label: "Back to farmer" }
  return { to: "/scans", label: "Back to scans" }
}

function ScanDetail() {
  const { uuid } = useParams()
  const { user } = useAuth()
  const isFarmer = user.role === "farmer"
  const location = useLocation()
  const back = getBack(location.state?.from, isFarmer)
  const navigate = useNavigate()
  const notify = useToast()

  const [scan, setScan] = useState(null)
  const [protocols, setProtocols] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [chosenLabel, setChosenLabel] = useState("")
  const [saving, setSaving] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // The photo is kept by the backend that received it; on another backend (the database is
  // shared) it can't load, so the placeholder shows instead of a broken image
  const [failedPhoto, setFailedPhoto] = useState(null) // the photo url that didn't load

  useEffect(() => {
    let ignore = false

    Promise.all([getScan(uuid), getProtocols(), isFarmer ? getMyFarmer(user) : null])
      .then(([scanData, protocolData, myFarm]) => {
        if (ignore) return
        // a farmer can only open their own scans
        if (isFarmer && (!myFarm || myFarm.farmer_id !== scanData.farmer_id)) {
          throw { response: { status: 404 } }
        }
        setScan(scanData)
        setProtocols(protocolData)
        setChosenLabel(scanData.predicted_label)
        setError("")
        setLoading(false)
      })
      .catch((err) => {
        if (ignore) return
        console.error(err)
        setError(err.response?.status === 404 ? "Scan not found." : "Could not load this scan.")
        setLoading(false)
      })

    return () => {
      ignore = true
    }
  }, [uuid, isFarmer, user])

  const handleVerify = async () => {
    setSaving(true)
    try {
      const updated = await verifyScan(uuid, chosenLabel, user.full_name)
      setScan(updated)
      notify("Scan verified.")
    } catch (err) {
      console.error(err)
      notify("Could not save the verification.", "error")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setShowDelete(false)
    setDeleting(true)
    try {
      await deleteScan(uuid)
      notify("Scan deleted.")
      navigate(back.to)
    } catch (err) {
      console.error(err)
      notify(err.response?.status === 403 ? "Only admins can delete scans." : "Could not delete the scan.", "error")
      setDeleting(false)
    }
  }

  if (loading) return <LoadingBlocks rows={3} height="h-48" label="Loading scan" />
  if (error) {
    return (
      <div className="flex flex-col items-start gap-4">
        <ErrorAlert className="">{error}</ErrorAlert>
        <BackButton to={back.to}>{back.label}</BackButton>
      </div>
    )
  }

  const secondDisease = getDisease(scan.second_label)
  const finalLabel = scan.verified_label || scan.predicted_label
  const photoFailed = Boolean(scan.image_url) && failedPhoto === scan.image_url
  const photo = photoFailed ? placeholderImage(finalLabel) : scanImage(scan)
  const photoNote = !scan.image_url
    ? "No photo available. The picture is only a placeholder for the diagnosis."
    : photoFailed
      ? "The photo isn't on this server (it was uploaded to another PinePal backend)."
      : ""
  const protocol = protocols.find((p) => p.label === finalLabel)

  return (
    <div>
      <div className="mb-4">
        <BackButton to={back.to}>{back.label}</BackButton>
      </div>
      <PageHeader
        title="Scan detail"
        description={`${scan.farm_name || scan.farmer_name} · ${formatDateTime(scan.scanned_at)}`}
        action={
          user.role === "admin" && (
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={deleting}
              onClick={() => setShowDelete(true)}
            >
              <Trash2Icon />
              {deleting ? "Deleting..." : "Delete scan"}
            </Button>
          )
        }
      />

      {/* left: the photo; right: the diagnosis, verifying it and where it was taken.
          On laptops the photo stretches to exactly the right column's height (no gaps);
          on phones it is a square above the rest. */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="relative aspect-square gap-0 py-0 lg:aspect-auto">
          <img
            src={photo}
            alt="Pineapple scan"
            onError={() => setFailedPhoto(scan.image_url)}
            className="absolute inset-0 size-full object-cover"
          />
          {photoNote && (
            <p className="absolute inset-x-0 bottom-0 bg-black/60 px-4 py-2 text-xs text-white">{photoNote}</p>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Diagnosis</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <DiseaseBadge label={finalLabel} />
                <span className="font-semibold">
                  {scan.verified_label ? "Verified diagnosis" : `${formatPercent(scan.confidence, 1)} confidence`}
                </span>
              </div>
              {!scan.verified_label && <ConfidenceBar value={scan.confidence} />}
              <div className="mt-3 mb-5 text-sm text-muted-foreground">
                {scan.verified_label && (
                  <div>
                    AI prediction: {getDisease(scan.predicted_label).name} ({formatPercent(scan.confidence, 1)})
                  </div>
                )}
                <div>
                  Second guess: {secondDisease ? secondDisease.name : scan.second_label} (
                  {formatPercent(scan.second_confidence, 1)})
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <Info label="Farmer">{scan.farmer_name}</Info>
                <Info label="Farm">{scan.farm_name || "–"}</Info>
                <Info label="Municipality">{scan.municipality}</Info>
                <Info label="Source">{scan.image_source}</Info>
                <Info label="Scanned">{formatDateTime(scan.scanned_at)}</Info>
                <Info label="Synced">{formatDateTime(scan.synced_at)}</Info>
                <div className="col-span-2">
                  <Info label="Notes">{scan.notes || "-"}</Info>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-semibold">Verify</CardTitle>
            </CardHeader>
            <CardContent>
              {scan.verified_label ? (
                <p className="text-sm">
                  Verified as <DiseaseBadge label={scan.verified_label} /> by {scan.verified_by}
                  {scan.verified_at && <> on {formatDateTime(scan.verified_at)}</>}
                  {scan.verified_label !== scan.predicted_label && (
                    <span className="font-semibold text-destructive"> (Corrected)</span>
                  )}
                </p>
              ) : isFarmer ? (
                <p className="text-sm text-muted-foreground">Not verified by an officer yet.</p>
              ) : (
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label className="mb-1.5 text-muted-foreground">Correct disease</Label>
                    <SelectField
                      className="w-full sm:w-48"
                      value={chosenLabel}
                      onChange={setChosenLabel}
                      options={diseaseOptions}
                    />
                  </div>
                  <Button disabled={saving} onClick={handleVerify}>
                    {saving ? "Saving..." : "Save"}
                  </Button>
                  {chosenLabel !== scan.predicted_label && (
                    <span className="text-sm font-semibold text-destructive">Corrected</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <MiniMap
            height={220}
            center={[scan.latitude, scan.longitude]}
            zoom={13}
            points={[
              {
                id: scan.scan_uuid,
                lat: scan.latitude,
                lng: scan.longitude,
                color: getDisease(finalLabel).color,
                text: getDisease(finalLabel).name,
              },
            ]}
          />
        </div>
      </div>

      {/* the care guide is long, so it gets the whole width under both columns */}
      <div className="mt-4">
        <ProtocolCard protocol={protocol} wide />
      </div>

      <ConfirmModal
        open={showDelete}
        title="Delete scan?"
        message={`Are you sure you want to delete the ${formatDate(scan.scanned_at)} scan from ${scan.farm_name || scan.farmer_name}? This can't be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  )
}

export default ScanDetail
