import { useSnackbar } from "notistack";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
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
  updateCoursePartial: (id: CourseId, changes: Partial<Course>) => Promise<void>;
  deleteCourse: (courseId: CourseId) => Promise<void>;
};

const CoursesContext = createContext<CoursesContextState>({
    default: true,
    courses: [],
    getCourse: () => undefined,
    addCourse: async () => {},
    updateCourse: async () => {},
    updateCoursePartial: async () => {},
    deleteCourse: async () => {},
});

type CoursesState = {
  courses: Record<CourseId, Course>;
  isLoading: boolean;
};

type CoursesAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_COURSES"; payload: Record<CourseId, Course> }
  | { type: "ADD_COURSE"; payload: Course }
  | { type: "UPDATE_COURSE"; payload: Partial<Course> & { id: CourseId } }
  | { type: "DELETE_COURSE"; payload: CourseId }
  | { type: "ROLLBACK_COURSES"; payload: Record<CourseId, Course> };

function coursesReducer(state: CoursesState, action: CoursesAction): CoursesState {
    switch (action.type) {
        case "SET_LOADING":
            return { ...state, isLoading: action.payload };
        case "SET_COURSES":
            return { ...state, courses: action.payload, isLoading: false };
        case "ADD_COURSE":
            return {
                ...state,
                courses: {
                    ...state.courses,
                    [action.payload.id]: action.payload,
                },
            };
        case "UPDATE_COURSE":
            return {
                ...state,
                courses: {
                    ...state.courses,
                    [action.payload.id]: {
                        ...state.courses[action.payload.id],
                        ...action.payload,
                    } as Course,
                },
            };
        case "DELETE_COURSE": {
            const next = { ...state.courses };
            delete next[action.payload];
            return { ...state, courses: next };
        }
        case "ROLLBACK_COURSES":
            return { ...state, courses: action.payload };
        default:
            return state;
    }
}

export const CoursesProvider = ({
    children,
}: {
  children: React.ReactNode;
}) => {
    const { addMessageHandler } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    const [state, dispatch] = useReducer(coursesReducer, {
        courses: {},
        isLoading: true,
    });

    const coursesArray = useMemo(() => Object.values(state.courses), [state.courses]);

    const getCourse = useCallback(
        (id: CourseId): Course | undefined => {
            return state.courses[id];
        },
        [state.courses],
    );

    const loadCourses = useCallback(() => {
        dispatch({ type: "SET_LOADING", payload: true });
        apiGetCourses()
            .then((fetchedCourses) => {
                const coursesMap: Record<CourseId, Course> = {};
                fetchedCourses.forEach((course) => {
                    coursesMap[course.id] = course;
                });
                dispatch({ type: "SET_COURSES", payload: coursesMap });
            })
            .catch((error) => {
                dispatch({ type: "SET_LOADING", payload: false });
                enqueueApiErrorSnackbar(enqueueSnackbar, "טעינת קורסים נכשלה.", error);
            });
    }, [dispatch, enqueueSnackbar]);

    const addCourse = useCallback(
        async (courseData: Omit<Course, "id">) => {
            const tempId = `temp-${Date.now()}` as CourseId;
            const optimisticCourse: Course = {
                id: tempId,
                ...courseData,
            };
            const previousCourses = { ...state.courses };

            dispatch({ type: "ADD_COURSE", payload: optimisticCourse });

            try {
                const createdCourse = await apiAddCourse(courseData);
                enqueueSnackbar(`יצירת מסלול ${courseData.name} הסתיימה בהצלחה.`, {
                    variant: "success",
                });
                dispatch({ type: "DELETE_COURSE", payload: tempId });
                dispatch({ type: "ADD_COURSE", payload: createdCourse });
                loadCourses();
            } catch (error) {
                dispatch({ type: "ROLLBACK_COURSES", payload: previousCourses });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `יצירת המסלול ${courseData.name} נכשלה!`,
                    error,
                );
            }
        },
        [state.courses, loadCourses, enqueueSnackbar],
    );

    const updateCourse = useCallback(
        async (course: Course) => {
            const previousCourses = { ...state.courses };
            dispatch({ type: "UPDATE_COURSE", payload: course });

            try {
                const updatedCourse = await apiSetCourse(course);
                enqueueSnackbar(`עדכון מסלול ${course.name} הסתיים בהצלחה.`, {
                    variant: "success",
                });
                dispatch({ type: "UPDATE_COURSE", payload: updatedCourse });
                loadCourses();
            } catch (error) {
                dispatch({ type: "ROLLBACK_COURSES", payload: previousCourses });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `עדכון המסלול ${course.name} נכשל!`,
                    error,
                );
            }
        },
        [state.courses, loadCourses, enqueueSnackbar],
    );

    const updateCoursePartial = useCallback(
        async (id: CourseId, changes: Partial<Course>) => {
            const previousCourses = { ...state.courses };
            const originalCourse = state.courses[id];
            if (!originalCourse) return;

            dispatch({ type: "UPDATE_COURSE", payload: { ...changes, id } });

            try {
                const updatedCourse = await apiSetCourse({ ...originalCourse, ...changes });
                enqueueSnackbar(`עדכון מסלול ${updatedCourse.name} הסתיים בהצלחה.`, {
                    variant: "success",
                });
                dispatch({ type: "UPDATE_COURSE", payload: updatedCourse });
                loadCourses();
            } catch (error) {
                dispatch({ type: "ROLLBACK_COURSES", payload: previousCourses });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `עדכון המסלול ${originalCourse.name} נכשל!`,
                    error,
                );
            }
        },
        [state.courses, loadCourses, enqueueSnackbar],
    );

    const deleteCourse = useCallback(
        async (courseId: CourseId) => {
            const previousCourses = { ...state.courses };
            const deletedCourseName = state.courses[courseId]?.name || courseId;

            dispatch({ type: "DELETE_COURSE", payload: courseId });

            try {
                await apiDeleteCourse(courseId);
                enqueueSnackbar(`מחיקת מסלול ${deletedCourseName} הסתיימה בהצלחה.`, {
                    variant: "success",
                });
                loadCourses();
            } catch (error) {
                dispatch({ type: "ROLLBACK_COURSES", payload: previousCourses });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    `מחיקת המסלול ${deletedCourseName} נכשלה!`,
                    error,
                );
            }
        },
        [state.courses, loadCourses, enqueueSnackbar],
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
                updateCoursePartial,
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
