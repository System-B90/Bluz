'use client';
import { enqueueApiErrorSnackbar } from '@/api-client/common';
import { getHiveUsers } from '@/api-client/hive';
import { Clearance, CourseUser } from '@/api-server/hive/types';
import { enqueueSnackbar } from 'notistack';
import
{
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';


export type HiveUsersContextState = {
    default: boolean;
    users: Record<string, CourseUser>;
    instructors: Array<CourseUser>;
};

const HiveUsersContext = createContext<HiveUsersContextState>({
    default: true,
    users: {},
    instructors: [],
});

export const HiveUsersProvider = ({ children }: { children: React.ReactNode; }) =>
{
    const [ users, setUsers ] = useState<Record<string, CourseUser>>({});

    const instructors = useMemo(() => Object.values(users).filter((user) => user.clearance >= Clearance.Segel), [ users ]);

    const loadUsers = useCallback(() =>
    {
        getHiveUsers().then((fetchedUsers) =>
        {
            const usersMap: Record<string, CourseUser> = {};
            fetchedUsers.forEach((user) =>
            {
                usersMap[ user.id ] = user;
            });
            setUsers(usersMap);
        }).catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'טעינת משתמשים נכשלה.', error));
    }, [ setUsers ]);

    useEffect(() =>
    {
        loadUsers();
    }, [ loadUsers ]);

    return (
        <HiveUsersContext.Provider value={ {
            default: false,
            users,
            instructors,
        } }>
            { children }
        </HiveUsersContext.Provider>
    );
};

export const useHiveUsers = () =>
{
    const context = useContext(HiveUsersContext);

    if (context === undefined || context.default)
    {
        throw new Error('useHiveUsers must be used within an HiveUsersProvider');
    }

    return context;
};
