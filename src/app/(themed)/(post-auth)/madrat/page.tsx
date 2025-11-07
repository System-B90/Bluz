'use client';
import { CalledStudentsProvider } from "@/components/madrat/called-students-provider";
import MadratMessageBox from "@/components/madrat/madrat-message-box";
import SideBar from "@/components/madrat/side-bar";
import { StudentsProvider } from "@/components/madrat/students-provider";

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
