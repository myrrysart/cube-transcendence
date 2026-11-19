import { createRoot } from "react-dom/client";
import { BatchStudio } from "./studio";
import "./studio.css";

const element = document.getElementById("root");
if (!element) throw new Error("Creator Studio root is missing.");
createRoot(element).render(<BatchStudio />);
