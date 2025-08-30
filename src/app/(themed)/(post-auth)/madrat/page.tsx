'use client';
import { CalledStudentsProvider } from "@/components/called-students-provider";
import MadratMessageBox from "@/components/madrat-message-box";
import SideBar from "@/components/side-bar";
import { StudentsProvider } from "@/components/students-provider";

export default function Home()
{
    return (
        <div className="flex flex-row w-full h-full box-border">
            <StudentsProvider>
                <CalledStudentsProvider>
                    <SideBar />
                </CalledStudentsProvider>
            </StudentsProvider>
            <MadratMessageBox />
        </div>
    );
}
