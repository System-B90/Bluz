"use client";
import { enqueueSnackbar } from "notistack";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
  apiAddCourse,
  apiDeleteCourse,
  apiGetCourses,
  apiSetCourse,
} from "@/api-client/courses";
import { Course, CourseId } from "@/api-shared/types/course";
import { useAuth } from "@/components/auth/AuthProvider";
import { MessageHandlerType } from "@/components/SessionWs";
import { MessageTypes } from "@/settings";

export type CoursesContextState = {
  default: boolean;
  courses: Array<Course>;
  getCourse: (id: CourseId) => Course | undefined;
  addCourse: (course: Omit<Course, "id">) => Promise<void>;
  updateCourse: (course: Course) => Promise<void>;
  deleteCourse: (courseId: CourseId) => Promise<void>;
};

const CoursesContext = createContext<CoursesContextState>({
  default: true,
  courses: [],
  getCourse: () => undefined,
  addCourse: async () => {},
  updateCourse: async () => {},
  deleteCourse: async () => {},
});

export const CoursesProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { addMessageHandler } = useAuth();
  const [courses, setCourses] = useState<Record<CourseId, Course>>({});
  const coursesArray = useMemo(() => Object.values(courses), [courses]);
  const getCourse = useCallback(
    (id: CourseId): Course | undefined => {
      return courses[id];
    },
    [courses],
  );

  const loadCourses = useCallback(() => {
    apiGetCourses()
      .then((fetchedCourses) => {
        const coursesMap: Record<CourseId, Course> = {};
        fetchedCourses.forEach((course) => {
          coursesMap[course.id] = course;
        });
        setCourses(coursesMap);
      })
      .catch((error) =>
        enqueueApiErrorSnackbar(enqueueSnackbar, "טעינת קורסים נכשלה.", error),
      );
  }, [setCourses]);

  const addCourse = useCallback(
    async (course: Omit<Course, "id">) => {
      await apiAddCourse(course)
        .then(() =>
          enqueueSnackbar(`יצירת מסלול ${course.name} הסתיימה בהצלחה.`, {
            variant: "success",
          }),
        )
        .catch((error) =>
          enqueueApiErrorSnackbar(
            enqueueSnackbar,
            `יצירת המסלול ${course.name} נכשלה!`,
            error,
          ),
        );
      loadCourses();
    },
    [loadCourses],
  );

  const updateCourse = useCallback(
    async (course: Course) => {
      await apiSetCourse(course)
        .then(() =>
          enqueueSnackbar(`עדכון מסלול ${course.name} הסתיים בהצלחה.`, {
            variant: "success",
          }),
        )
        .catch((error) =>
          enqueueApiErrorSnackbar(
            enqueueSnackbar,
            `עדכון המסלול ${course.name} נכשל!`,
            error,
          ),
        );
      loadCourses();
    },
    [loadCourses],
  );

  const deleteCourse = useCallback(
    async (courseId: CourseId) => {
      await apiDeleteCourse(courseId)
        .then(() =>
          enqueueSnackbar(
            `מחיקת מסלול ${courses[courseId]?.name || courseId} הסתיימה בהצלחה.`,
            { variant: "success" },
          ),
        )
        .catch((error) =>
          enqueueApiErrorSnackbar(
            enqueueSnackbar,
            `מחיקת המסלול ${courses[courseId]?.name ?? courseId} נכשלה!`,
            error,
          ),
        );
      loadCourses();
    },
    [loadCourses, courses],
  );

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  const onWebSocketMessage: MessageHandlerType = useCallback(
    (messageType: MessageTypes, _data: any) => {
      if (messageType === MessageTypes.COURSES_UPDATE) {
        loadCourses();
      }
    },
    [loadCourses],
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    return addMessageHandler(onWebSocketMessage);
  }, [addMessageHandler, onWebSocketMessage]);

  return (
    <CoursesContext.Provider
      value={{
        default: false,
        courses: coursesArray,
        getCourse,
        addCourse,
        updateCourse,
        deleteCourse,
      }}
    >
      {children}
    </CoursesContext.Provider>
  );
};

export const useCourses = () => {
  const context = useContext(CoursesContext);

  if (context === undefined || context.default) {
    throw new Error("useCourses must be used within an CoursesProvider");
  }

  return context;
};
