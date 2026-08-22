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
import { getHiveUsers } from "@/api-client/hive";
import { Clearance, CourseUser } from "@/api-shared/types/hive";

export type HiveUsersContextState = {
    default: boolean;
    users: Record<number, CourseUser>;
    instructors: Array<CourseUser>;
    getInstructor: (id: number) => CourseUser | undefined;
};

const HiveUsersContext = createContext<HiveUsersContextState>({
    default: true,
    users: {},
    instructors: [],
    getInstructor: () => undefined,
});

export const HiveUsersProvider = ({
    children,
}: {
    children: React.ReactNode;
}) => {
    const [users, setUsers] = useState<Record<string, CourseUser>>({});

    const instructors = useMemo(
        () =>
            Object.values(users).filter(
                (user) => user.clearance >= Clearance.Segel,
            ),
        [users],
    );
    const getInstructor = useCallback(
        (id: number): CourseUser | undefined => {
            const user = users[id];
            return user?.clearance >= Clearance.Segel ? user : undefined;
        },
        [users],
    );

    const loadUsers = useCallback(() => {
        getHiveUsers()
            .then((fetchedUsers) => {
                const usersMap: Record<number, CourseUser> = {};
                fetchedUsers.forEach((user) => {
                    usersMap[user.id] = user;
                });
                setUsers(usersMap);
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת משתמשים נכשלה.",
                    error,
                ),
            );
    }, [setUsers]);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    // A fresh object literal here re-renders every consumer app-wide on
    // every render of this provider, including event tiles that read
    // getInstructor. Memoize like SettingsProvider.tsx.
    const value = useMemo(
        () => ({
            default: false,
            users,
            instructors,
            getInstructor,
        }),
        [users, instructors, getInstructor],
    );

    return (
        <HiveUsersContext.Provider value={value}>
            {children}
        </HiveUsersContext.Provider>
    );
};

export const useHiveUsers = () => {
    const context = useContext(HiveUsersContext);

    if (context === undefined || context.default) {
        throw new Error(
            "useHiveUsers must be used within an HiveUsersProvider",
        );
    }

    return context;
};
