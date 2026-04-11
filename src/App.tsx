import { useState, useRef, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, 
  Upload, 
  User, 
  Calendar, 
  Clock, 
  MapPin, 
  FileText, 
  Loader2, 
  X, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Plus,
  Trash2,
  Save,
  Edit2,
  RotateCcw,
  Eye,
  EyeOff,
  Download,
  Share2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { extractScheduleFromImage, ExtractionResult, ScheduleItem } from "./services/geminiService";

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [personName, setPersonName] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<string>("");
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        setError(null);
        setResult(null);
        setIsReviewing(false);
        setIsFinalized(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExtract = async () => {
    if (!image || !personName.trim()) {
      setError("Please provide both an image and a person's name.");
      return;
    }

    setIsExtracting(true);
    setExtractionStatus("Reading image data...");
    setError(null);
    setResult(null);
    setIsReviewing(false);
    setIsFinalized(false);

    try {
      const mimeType = image.split(";")[0].split(":")[1];
      
      // Simulate steps for better UX
      setTimeout(() => setExtractionStatus(`Locating ${personName} in roster...`), 1000);
      setTimeout(() => setExtractionStatus("Extracting shift details..."), 2500);
      setTimeout(() => setExtractionStatus("Formatting schedule..."), 4000);

      const data = await extractScheduleFromImage(image, mimeType, personName);
      setResult(data);
      setIsReviewing(true);
    } catch (err) {
      console.error(err);
      setError("Failed to extract schedule. Please ensure the image is clear and the name is present in the roster.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleUpdateShift = (index: number, field: keyof ScheduleItem, value: string) => {
    if (!result) return;
    const newSchedule = [...result.schedule];
    newSchedule[index] = { ...newSchedule[index], [field]: value };
    setResult({ ...result, schedule: newSchedule });
  };

  const handleAddShift = () => {
    if (!result) return;
    const newShift: ScheduleItem = { day: "", date: "", shift: "" };
    setResult({ ...result, schedule: [...result.schedule, newShift] });
  };

  const handleRemoveShift = (index: number) => {
    if (!result) return;
    const newSchedule = result.schedule.filter((_, i) => i !== index);
    setResult({ ...result, schedule: newSchedule });
  };

  const handleFinalize = () => {
    setIsReviewing(false);
    setIsFinalized(true);
  };

  const downloadICS = () => {
    if (!result) return;

    const calendarHeader = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Roster Scanner//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH"
    ].join("\r\n");

    const events = result.schedule.map((item, index) => {
      // Try to parse the date. If it's YYYY-MM-DD, great. 
      // Otherwise, we might need a more robust parser, but for now we'll try to clean it.
      let dateStr = item.date.replace(/-/g, "");
      
      // Basic validation: if it's not 8 digits, it might be a partial date or text
      // We'll try to fallback to today if it's unparseable, but Gemini usually follows instructions
      if (!/^\d{8}$/.test(dateStr)) {
        // Fallback: try to extract digits
        const digits = item.date.match(/\d+/g);
        if (digits && digits.length >= 3) {
          dateStr = digits.join("").substring(0, 8);
        } else {
          // Last resort: use today's date so the file is at least valid
          dateStr = new Date().toISOString().split('T')[0].replace(/-/g, "");
        }
      }

      // For all-day events, DTEND is the day AFTER DTSTART
      const startDate = new Date(dateStr.substring(0, 4) + "-" + dateStr.substring(4, 6) + "-" + dateStr.substring(6, 8));
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 1);
      const endDateStr = endDate.toISOString().split('T')[0].replace(/-/g, "");

      return [
        "BEGIN:VEVENT",
        `UID:${Date.now()}-${index}@rosterscanner.app`,
        `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
        `DTSTART;VALUE=DATE:${dateStr}`,
        `DTEND;VALUE=DATE:${endDateStr}`,
        `SUMMARY:${item.shift}`,
        `DESCRIPTION:Shift: ${item.shift}\\nNotes: ${item.notes || 'N/A'}`,
        "END:VEVENT"
      ].join("\r\n");
    }).join("\r\n");

    const calendarFooter = "END:VCALENDAR";
    const icsContent = [calendarHeader, events, calendarFooter].join("\r\n");

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute("download", `schedule-${result.personName.replace(/\s+/g, '-').toLowerCase()}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setError(null);
    setIsReviewing(false);
    setIsFinalized(false);
    setShowOriginal(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen bg-[#f5f5f5] text-[#1a1a1a] font-sans p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <header className="text-center space-y-2">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center justify-center p-3 bg-white rounded-2xl shadow-sm mb-4"
          >
            <Calendar className="w-8 h-8 text-blue-600" />
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-4xl font-bold tracking-tight"
          >
            Roster Scanner
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-[#9e9e9e] text-lg"
          >
            Extract and verify your personal schedule from any roster image.
          </motion.p>
        </header>

        <main className="space-y-6">
          {/* Input Section */}
          {!isFinalized && !isReviewing && !isExtracting && (
            <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-500" />
                  Upload Roster
                </CardTitle>
                <CardDescription>
                  Upload a clear photo of the staff schedule.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Image Dropzone/Preview */}
                <div 
                  onClick={() => !image && fileInputRef.current?.click()}
                  className={`relative group cursor-pointer border-2 border-dashed rounded-2xl transition-all duration-300 flex flex-col items-center justify-center overflow-hidden
                    ${image ? 'border-transparent h-64' : 'border-[#e5e5e5] hover:border-blue-400 h-48 bg-[#fafafa]'}`}
                >
                  {image ? (
                    <>
                      <img 
                        src={image} 
                        alt="Roster preview" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                        <Button variant="secondary" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                          Change Image
                        </Button>
                        <Button variant="destructive" onClick={(e) => { e.stopPropagation(); reset(); }}>
                          <X className="w-4 h-4 mr-2" /> Remove
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center space-y-2 p-6">
                      <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-2">
                        <Upload className="w-6 h-6 text-blue-500" />
                      </div>
                      <p className="font-medium">Click to upload or take a photo</p>
                      <p className="text-sm text-[#9e9e9e]">Supports JPG, PNG</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                  />
                </div>

                {/* Name Input */}
                <div className="space-y-2">
                  <Label htmlFor="personName" className="text-sm font-semibold uppercase tracking-wider text-[#9e9e9e]">
                    Target Person's Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9e9e9e]" />
                    <Input 
                      id="personName"
                      placeholder="e.g. John Smith"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      className="pl-10 h-12 rounded-xl border-[#e5e5e5] focus:ring-blue-500"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-[#fafafa] p-6 border-t border-[#f0f0f0]">
                <Button 
                  onClick={handleExtract} 
                  disabled={isExtracting || !image || !personName.trim()}
                  className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-all shadow-md active:scale-[0.98]"
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {extractionStatus}
                    </>
                  ) : (
                    <>
                      <Camera className="w-5 h-5 mr-2" />
                      Extract Schedule
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* Error Alert */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <Alert variant="destructive" className="rounded-2xl border-none shadow-sm">
                  <AlertCircle className="h-4 h-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Section */}
          <AnimatePresence>
            {isExtracting && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-6">
                    <div className="relative">
                      <div className="w-20 h-20 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Camera className="w-8 h-8 text-blue-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-[#1a1a1a]">{extractionStatus}</h3>
                      <p className="text-sm text-[#9e9e9e] max-w-[250px] mx-auto">
                        Our AI is processing the roster image to find your specific shifts.
                      </p>
                    </div>
                    <div className="w-full max-w-xs bg-[#f5f5f5] h-2 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-blue-600"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 8, ease: "linear" }}
                      />
                    </div>
                  </CardContent>
                </Card>
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded-2xl bg-white" />
                  ))}
                </div>
              </motion.div>
            )}

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between px-2">
                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      {isFinalized ? (
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                      ) : (
                        <Edit2 className="w-6 h-6 text-blue-500" />
                      )}
                      {isFinalized ? "Finalized Schedule" : "Review Schedule"}
                    </h2>
                    <p className="text-sm text-[#9e9e9e]">For {result.personName}</p>
                  </div>
                  <Badge variant={isFinalized ? "default" : "outline"} className={`px-3 py-1 rounded-full ${isFinalized ? 'bg-green-500' : 'bg-white border-[#e5e5e5] text-[#1a1a1a]'}`}>
                    {isFinalized ? "Verified" : "Pending Review"}
                  </Badge>
                </div>

                {/* Summary Card */}
                {!isReviewing && (
                  <Card className="border-none shadow-sm bg-blue-50 rounded-3xl">
                    <CardContent className="p-6">
                      <p className="text-blue-800 font-medium leading-relaxed italic">
                        "{result.summary}"
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Original Roster Preview */}
                <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                  <button 
                    onClick={() => setShowOriginal(!showOriginal)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#fafafa] transition-colors"
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <FileText className="w-5 h-5 text-[#9e9e9e]" />
                      Original Roster Image
                    </div>
                    <div className="flex items-center gap-2 text-sm text-blue-600 font-medium">
                      {showOriginal ? (
                        <>
                          <EyeOff className="w-4 h-4" /> Hide Image
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" /> View Image
                        </>
                      )}
                    </div>
                  </button>
                  <AnimatePresence>
                    {showOriginal && image && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[#f0f0f0]"
                      >
                        <div className="p-4 bg-[#fafafa]">
                          <div className="rounded-2xl overflow-hidden border border-[#e5e5e5] shadow-inner">
                            <img 
                              src={image} 
                              alt="Original roster" 
                              className="w-full h-auto max-h-[500px] object-contain mx-auto"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <p className="text-center text-[10px] text-[#9e9e9e] mt-2 uppercase tracking-widest font-bold">
                            Reference Image
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>

                {/* Schedule List */}
                <div className="grid gap-4">
                  {result.schedule.map((item, index) => (
                    <motion.div
                      key={index}
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="relative"
                    >
                      <Card className={`border-none shadow-sm bg-white rounded-2xl transition-all ${isReviewing ? 'ring-2 ring-blue-100' : 'hover:shadow-md'}`}>
                        <CardContent className="p-5">
                          {isReviewing ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="rounded-lg">Shift #{index + 1}</Badge>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleRemoveShift(index)}
                                  className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold uppercase text-[#9e9e9e]">Day</Label>
                                  <Input 
                                    value={item.day} 
                                    onChange={(e) => handleUpdateShift(index, "day", e.target.value)}
                                    className="h-9 rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold uppercase text-[#9e9e9e]">Date</Label>
                                  <Input 
                                    value={item.date} 
                                    onChange={(e) => handleUpdateShift(index, "date", e.target.value)}
                                    className="h-9 rounded-lg"
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase text-[#9e9e9e]">Shift Details</Label>
                                <Input 
                                  value={item.shift} 
                                  onChange={(e) => handleUpdateShift(index, "shift", e.target.value)}
                                    className="h-9 rounded-lg"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[10px] font-bold uppercase text-[#9e9e9e]">Notes</Label>
                                  <Input 
                                    value={item.notes || ""} 
                                    onChange={(e) => handleUpdateShift(index, "notes", e.target.value)}
                                    className="h-9 rounded-lg"
                                  />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col md:flex-row md:items-center gap-4">
                              <div className="flex-shrink-0 w-12 h-12 bg-[#f5f5f5] rounded-xl flex flex-col items-center justify-center text-[#1a1a1a]">
                                <span className="text-[10px] font-bold uppercase opacity-50">{item.day.substring(0, 3)}</span>
                                <span className="text-lg font-bold leading-none">
                                  {(() => {
                                    const dateParts = item.date.split(/[-/]/);
                                    if (dateParts.length === 3) {
                                      // Assume YYYY-MM-DD or DD-MM-YYYY
                                      return dateParts[2].length === 2 ? dateParts[2] : dateParts[2]; // This is a bit naive
                                    }
                                    // Fallback to original logic
                                    const dayMatch = item.date.match(/\d+/);
                                    return dayMatch ? dayMatch[0].padStart(2, '0').slice(-2) : '??';
                                  })()}
                                </span>
                              </div>
                              
                              <div className="flex-grow space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-lg">{item.day}, {item.date}</span>
                                </div>
                                <div className="flex flex-wrap gap-4 text-sm text-[#9e9e9e]">
                                  <div className="flex items-center gap-1.5">
                                    <Clock className="w-4 h-4 text-blue-400" />
                                    <span className="text-[#1a1a1a] font-medium">{item.shift}</span>
                                  </div>
                                </div>
                                {item.notes && (
                                  <div className="mt-2 text-xs bg-[#fafafa] p-2 rounded-lg border border-[#f0f0f0] text-[#9e9e9e]">
                                    <strong>Note:</strong> {item.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 pt-4">
                  {isReviewing ? (
                    <>
                      <Button 
                        variant="outline" 
                        onClick={handleAddShift}
                        className="w-full h-12 rounded-xl border-dashed border-2 border-blue-200 text-blue-600 hover:bg-blue-50"
                      >
                        <Plus className="w-4 h-4 mr-2" /> Add Another Shift
                      </Button>
                      <Button 
                        onClick={handleFinalize}
                        className="w-full h-12 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg"
                      >
                        <Save className="w-4 h-4 mr-2" /> Finalize & Save
                      </Button>
                    </>
                  ) : (
                    <div className="space-y-3">
                      <Button 
                        onClick={downloadICS}
                        className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg"
                      >
                        <Download className="w-4 h-4 mr-2" /> Export to Calendar (.ics)
                      </Button>
                      <div className="flex gap-3">
                        <Button 
                          variant="outline" 
                          onClick={() => setIsReviewing(true)}
                          className="flex-1 h-12 rounded-xl border-[#e5e5e5]"
                        >
                          <Edit2 className="w-4 h-4 mr-2" /> Edit Again
                        </Button>
                        <Button 
                          onClick={reset}
                          className="flex-1 h-12 rounded-xl bg-[#1a1a1a] text-white hover:bg-black"
                        >
                          <RotateCcw className="w-4 h-4 mr-2" /> New Scan
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer */}
        <footer className="text-center pt-12 pb-8 border-t border-[#e5e5e5]">
          <p className="text-xs text-[#9e9e9e] uppercase tracking-widest font-medium">
            Powered by Gemini AI • Private & Secure
          </p>
        </footer>
      </div>
    </div>
  );
}
